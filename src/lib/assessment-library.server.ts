import { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { AssessmentError } from './assessment-data.server'

export const libraryQuerySchema = z.object({
  classId: z.string().min(1).max(100), studentId: z.string().max(100).default(''),
  mode: z.enum(['', 'EXAM', 'PRACTICE']).default(''),
  status: z.enum(['', 'QUEUED', 'GENERATING', 'READY', 'APPROVED', 'FAILED']).default(''),
  search: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(1000000).default(1),
})
export type LibraryQuery = z.infer<typeof libraryQuerySchema>
export const assessmentSummarySelect = {
  id: true, studentId: true, classWorkspaceId: true, mode: true, status: true, from: true, to: true,
  createdAt: true, submittedAt: true, approvedAt: true, score: true, error: true, model: true,
  classWorkspace: { select: { name: true } },
  student: { select: { firstName: true, lastName: true } },
} satisfies Prisma.AssessmentSelect
export async function libraryWhere(db: PrismaClient, user: { id: string; role: string }, query: LibraryQuery): Promise<Prisma.AssessmentWhereInput> {
  const staff = user.role === 'ADMIN'
  if (user.role === 'OBSERVER' || (!staff && query.studentId && query.studentId !== user.id) || (!staff && query.mode === 'EXAM')) throw new AssessmentError('Assessments unavailable.', 404)
  if (query.classId === 'all' && !staff) throw new AssessmentError('Assessments unavailable.', 404)
  const course = query.classId === 'all' ? { id: 'all' } : await db.classWorkspace.findFirst({ where: { id: query.classId, ...(!staff ? { members: { some: { userId: user.id } } } : {}) }, select: { id: true } })
  if (!course) throw new AssessmentError('Course unavailable.', 404)
  return {
    ...(query.classId !== 'all' ? { classWorkspaceId: query.classId } : {}),
    ...(staff ? query.studentId ? { studentId: query.studentId } : {} : { studentId: user.id }),
    ...(!staff ? { mode: 'PRACTICE' } : query.mode ? { mode: query.mode } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { AND: query.search.split(/\s+/).map(term => ({ OR: [
      { id: { contains: term, mode: 'insensitive' as const } },
      { student: { firstName: { contains: term, mode: 'insensitive' as const } } },
      { student: { lastName: { contains: term, mode: 'insensitive' as const } } },
    ] })) } : {}),
  }
}
