import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient
export class IndividualBoardError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

// Always called within the enclosing enrollment/provisioning transaction.
// A unique class + owner key prevents duplicates even after a board is renamed.
export async function ensureIndividualBoard(tx: Prisma.TransactionClient, classId: string, userId: string) {
  const existing = await tx.team.findUnique({ where: { classWorkspaceId_individualOwnerId: { classWorkspaceId: classId, individualOwnerId: userId } }, select: { id: true } })
  if (existing) return false
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true } })
  await tx.team.create({ data: {
    name: `${user.firstName} ${user.lastName}`,
    description: 'Individual student Kanban board.',
    classWorkspaceId: classId, individualOwnerId: userId,
    // Local board leadership permits managing instructor-created work too.
    // This never promotes the student's account role.
    members: { create: { userId, role: 'LEAD' } },
  } })
  return true
}

// Preview includes enrollment and board decisions so a changed class requires
// review again. Individual boards retain ordinary class read visibility.
export async function individualBoardPlan(db: Db, classId: string) {
  const course = await db.classWorkspace.findUnique({ where: { id: classId }, select: { archivedAt: true } })
  if (!course) throw new IndividualBoardError('Class not found.', 404)
  if (course.archivedAt) throw new IndividualBoardError('Restore this archived class before creating boards.', 409)
  const members = await db.classWorkspaceMember.findMany({
    where: { classWorkspaceId: classId, user: { role: { in: ['MEMBER', 'TEAM_LEAD'] } } },
    select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { userId: 'asc' }, take: 1001,
  })
  if (members.length > 1000) throw new IndividualBoardError('Use roster import in batches of up to 100 students for this large class.')
  const boards = await db.team.findMany({ where: { classWorkspaceId: classId, individualOwnerId: { not: null } }, select: { individualOwnerId: true } })
  const owners = new Set(boards.map(b => b.individualOwnerId))
  const rows = members.map(({ user }) => ({ ...user, action: owners.has(user.id) ? 'KEEP' as const : 'CREATE' as const }))
  return { rows, previewHash: createHash('sha256').update(JSON.stringify({ classId, rows })).digest('hex') }
}

export async function createClassIndividualBoards(db: PrismaClient, classId: string, previewHash: string) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ClassWorkspace" WHERE id=${classId} FOR UPDATE`
    const plan = await individualBoardPlan(tx, classId)
    if (plan.previewHash !== previewHash) throw new IndividualBoardError('Enrollment or boards changed. Preview again before creating boards.', 409)
    let created = 0
    for (const row of plan.rows) if (await ensureIndividualBoard(tx, classId, row.id)) created++
    return { created, kept: plan.rows.length - created }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 })
}
