import { createHash, randomBytes } from 'node:crypto'
import { ensureIndividualBoard } from './individual-boards.server'
import bcrypt from 'bcryptjs'
import { Prisma, PrismaClient } from '@prisma/client'
import { parseRoster, type RosterRow, type RosterPreviewRow } from './student-roster'
export class RosterError extends Error { constructor(message: string, public status = 400) { super(message) } }
type Db = PrismaClient | Prisma.TransactionClient
export async function rosterPlan(db: Db, classId: string, rows: RosterRow[], individualBoards = false) {
  const course = await db.classWorkspace.findUnique({ where: { id: classId }, select: { id: true, name: true, archivedAt: true } })
  if (!course) throw new RosterError('Class not found.', 404)
  if (course.archivedAt) throw new RosterError('Restore this archived class before importing students.', 409)
  const accounts = await db.user.findMany({ where: { OR: rows.map(r => ({ email: { equals: r.email, mode: 'insensitive' as const } })) }, select: { id: true, email: true, firstName: true, lastName: true, role: true, classMemberships: { where: { classWorkspaceId: classId }, select: { id: true } } } })
  const boards = individualBoards ? await db.team.findMany({ where: { classWorkspaceId: classId, individualOwnerId: { not: null } }, select: { individualOwnerId: true } }) : []
  const owners = new Set(boards.map(b => b.individualOwnerId))
  const plan: RosterPreviewRow[] = rows.map(row => {
    const found = accounts.filter(a => a.email.toLowerCase() === row.email)
    if (found.length > 1) throw new RosterError(`Record ${row.row}: multiple accounts match this email. Resolve the duplicate accounts in Users first.`)
    const account = found[0]
    if (account && !['MEMBER', 'TEAM_LEAD'].includes(account.role)) throw new RosterError(`Record ${row.row}: this email belongs to a staff or observer account. Remove it from the student roster.`)
    return { ...row, boardAction: individualBoards ? (account && owners.has(account.id) ? 'KEEP' : 'CREATE') : 'NONE', email: account?.email || row.email, accountId: account?.id || null, action: !account ? 'CREATE' : account.classMemberships.length ? 'SKIP' : 'ENROLL', warning: account && (account.firstName !== row.firstName || account.lastName !== row.lastName) ? `Existing name retained: ${account.firstName} ${account.lastName}` : '' }
  })
  // Binds the preview to the exact roster and current matches. Recheck under the
  // import transaction: stale previews never silently change identity decisions.
  const previewHash = createHash('sha256').update(JSON.stringify({ classId, rows, plan, individualBoards })).digest('hex')
  return { className: course.name, rows: plan, previewHash }
}
// individualBoards applies only to this reviewed import, not future enrollment.
// Account, enrollment and optional board writes either all commit or all roll back.
export async function importRoster(db: PrismaClient, classId: string, csv: string, previewHash: string, individualBoards = false) {
  const rows = parseRoster(csv), initial = await rosterPlan(db, classId, rows, individualBoards)
  if (initial.previewHash !== previewHash) throw new RosterError('The roster or accounts changed. Preview again before importing.', 409)
  const fresh = initial.rows.filter(r => r.action === 'CREATE')
  const prepared = new Map<string, { password: string; passwordHash: string }>()
  // Hash outside the database transaction; credentials exist only for this
  // response. Never overwrite an existing account's password, name or role.
  for (let offset = 0; offset < fresh.length; offset += 4) {
    await Promise.all(fresh.slice(offset, offset + 4).map(async r => {
      const password = 'SK-' + randomBytes(18).toString('base64url')
      prepared.set(r.email, { password, passwordHash: await bcrypt.hash(password, 12) })
    }))
  }
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ClassWorkspace" WHERE id=${classId} FOR UPDATE`
    const current = await rosterPlan(tx, classId, rows, individualBoards)
    if (current.previewHash !== previewHash) throw new RosterError('The roster or accounts changed. Preview again before importing.', 409)
    const credentials = []; let enrolled = 0, skipped = 0, boardsCreated = 0, boardsKept = 0
    for (const row of current.rows) {
      let userId = row.accountId
      if (row.action === 'CREATE') {
        const auth = prepared.get(row.email)!
        const user = await tx.user.create({ data: { email: row.email, firstName: row.firstName, lastName: row.lastName, role: 'MEMBER', passwordHash: auth.passwordHash, color: '#' + randomBytes(3).toString('hex') }, select: { id: true } })
        userId = user.id
        credentials.push({ firstName: row.firstName, lastName: row.lastName, email: row.email, password: auth.password })
      }
      if (row.action === 'SKIP') skipped++
      else {
        await tx.classWorkspaceMember.create({ data: { classWorkspaceId: classId, userId: userId! } })
        enrolled++
      }
      if (individualBoards) {
        if (await ensureIndividualBoard(tx, classId, userId!)) boardsCreated++
        else boardsKept++
      }
    }
    return { created: credentials.length, enrolled, skipped, credentials, boardsCreated, boardsKept }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 })
}
