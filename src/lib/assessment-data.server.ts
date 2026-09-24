import { PrismaClient, Prisma } from '@prisma/client'
import { ASSESSMENT_PROMPT_VERSION } from './assessments'
import { parseExportOptions } from './team-export'

export class AssessmentError extends Error { constructor(message: string, readonly status = 400) { super(message) } }
export interface Evidence { id: string; title: string; description: string; contribution: string; tasks: { code: string; description: string; note: string }[] }
export async function assessmentScope(db: PrismaClient | Prisma.TransactionClient, user: { id: string; role: string }, classId: string, studentId: string, write = false) {
  if (user.role === 'OBSERVER' || (user.role !== 'ADMIN' && studentId !== user.id)) throw new AssessmentError('Assessment unavailable.', 404)
  // In mutation transactions, serialize against class archival/deletion.
  if (write) await db.$queryRaw`SELECT id FROM "ClassWorkspace" WHERE id=${classId} FOR SHARE`
  const workspace = await db.classWorkspace.findUnique({ where: { id: classId }, select: { id: true, name: true, archivedAt: true, members: { where: { userId: studentId, user: { role: { not: 'OBSERVER' } } }, select: { userId: true } } } })
  if (!workspace || !workspace.members.length) throw new AssessmentError('Student is not enrolled in this course.', 404)
  if (write && workspace.archivedAt) throw new AssessmentError('Archived courses are read only.', 409)
  return workspace
}
export async function collectEvidence(db: PrismaClient | Prisma.TransactionClient, studentId: string, classId: string, from: string, to: string): Promise<Evidence[]> {
  const dates = { gte: new Date(from + 'T00:00:00Z'), lt: new Date(Date.parse(to + 'T00:00:00Z') + 86400000) }
  const tickets = await db.ticket.findMany({ where: {
    team: { classWorkspaceId: classId },
    OR: [
      { assigneeId: studentId, status: { in: ['DOING', 'DONE'] }, OR: [{ createdAt: dates }, { updatedAt: dates }, { startedAt: dates }, { completedAt: dates }] },
      { dcwfTasks: { some: { createdById: studentId, createdAt: dates, note: { not: null } } } },
    ],
  }, orderBy: { updatedAt: 'desc' }, take: 60, select: {
    id: true, title: true, description: true, assigneeId: true, status: true,
    dcwfTasks: { where: { createdById: studentId, createdAt: dates }, take: 8, orderBy: { createdAt: 'desc' }, select: { note: true, ksat: { select: { ksatId: true, description: true } } } },
  } })
  const candidates = tickets.map(t => ({ id: t.id, title: t.title.slice(0, 300), description: t.assigneeId === studentId ? (t.description || '').slice(0, 2500) : '', contribution: t.assigneeId === studentId ? `Assigned to student; status ${t.status}. Assignment/status are self-reported evidence, not proof of mastery.` : 'Student-authored task notes only; do not attribute the whole ticket to this student.', tasks: t.dcwfTasks.filter(d => d.note?.trim()).map(d => ({ code: d.ksat.ksatId, description: d.ksat.description.slice(0, 1000), note: d.note!.slice(0, 1000) })) })).filter(t => t.description.trim().length >= 30 || t.tasks.some(d => d.note.length >= 30)).slice(0, 30)
  let remaining = 24000
  const selected: Evidence[] = []
  for (const evidence of candidates) {
    const size = JSON.stringify(evidence).length
    if (size > remaining) continue
    selected.push(evidence); remaining -= size
  }
  return selected
}
export async function queueAssessment(db: PrismaClient, user: { id: string; role: string }, input: { classId: string; studentId: string; from: string; to: string; mode: string; references?: string }) {
  const { classId, studentId, mode } = input
  if (!['PRACTICE', 'EXAM'].includes(mode) || (mode === 'EXAM' && user.role !== 'ADMIN')) throw new AssessmentError('Only instructional staff can create exam drafts.', 403)
  const { from, to } = parseExportOptions(new URLSearchParams({ from: input.from, to: input.to }))
  return db.$transaction(async tx => {
    // Serialize a student's requests, without holding any transaction during inference.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assessment:${studentId}`}))`
    await assessmentScope(tx, user, classId, studentId, true)
    const pending = await tx.assessment.findFirst({ where: { studentId, status: { in: ['QUEUED', 'GENERATING'] } } })
    if (pending) throw new AssessmentError('A test for this student is already queued or generating. Wait for it to finish or cancel it.', 409)
    const recent = await tx.assessment.findFirst({ where: { studentId, createdAt: { gt: new Date(Date.now() - 60_000) } } })
    if (recent) throw new AssessmentError('Please wait a minute between new test requests.', 429)
    if (await tx.assessment.count({ where: { status: { in: ['QUEUED', 'GENERATING'] } } }) >= 100) throw new AssessmentError('The assessment queue is full. Try again later.', 503)
    const sources = await collectEvidence(tx, studentId, classId, from, to)
    if (!sources.length || JSON.stringify(sources).length < 600) throw new AssessmentError('Not enough documented work to make a useful 25-question test. Add detailed work descriptions or personal task notes, or select a wider date range.')
    return tx.assessment.create({ data: { studentId, classWorkspaceId: classId, createdById: user.id, mode, from, to, sources: sources as unknown as Prisma.InputJsonValue, references: user.role === 'ADMIN' ? input.references?.trim().slice(0, 20000) || null : null, promptVersion: ASSESSMENT_PROMPT_VERSION } })
  }, { timeout: 15_000 })
}
