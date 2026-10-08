import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/assessment-prisma.server'
import { AssessmentError } from '@/lib/assessment-data.server'

const input = z.object({
  classId: z.string().min(1).max(100).refine(id => id !== 'all'),
  id: z.string().min(1).max(100).optional(),
  allFailed: z.literal(true).optional(),
}).strict().refine(body => !!body.id !== !!body.allFailed, 'Choose one failed attempt or all failed attempts in a class.')

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only instructional staff can delete failed attempts.' }, { status: 403 })
  try {
    const body = input.parse(await request.json())
    const deleted = await prisma.$transaction(async tx => {
      // Serialize against class archival; cleanup never changes successful or running versions.
      await tx.$queryRaw`SELECT id FROM "ClassWorkspace" WHERE id=${body.classId} FOR SHARE`
      const course = await tx.classWorkspace.findUnique({ where: { id: body.classId }, select: { archivedAt: true } })
      if (!course) throw new AssessmentError('Course unavailable.', 404)
      if (course.archivedAt) throw new AssessmentError('Archived courses are read only. Restore the course before deleting failed attempts.', 409)
      const result = await tx.assessment.deleteMany({ where: { classWorkspaceId: body.classId, status: 'FAILED', ...(body.id ? { id: body.id } : {}) } })
      if (body.id && !result.count) throw new AssessmentError('Failed attempt unavailable. Only failed attempts can be deleted.', 409)
      return result.count
    })
    return NextResponse.json({ deleted }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof AssessmentError ? error.message : 'Could not delete failed attempts. Select a specific course and try again.' }, { status: error instanceof AssessmentError ? error.status : 400 })
  }
}
