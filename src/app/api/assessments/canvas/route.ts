import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/assessment-prisma.server'
import { buildCanvasExport, canvasExportable, type CanvasAssessment } from '@/lib/canvas-qti'
const input = z.object({
  classId: z.string().min(1).max(100), ids: z.array(z.string().min(1).max(100)).min(1).max(100).optional(),
  latestApproved: z.boolean().default(false), format: z.enum(['qti', 'individual']).default('qti'),
  points: z.number().int().min(1).max(100).default(4),
}).refine(b => (b.latestApproved && !b.ids) || (!b.latestApproved && !!b.ids), 'Choose assessments or latest accepted exams.')
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Only instructional staff can export answer-bearing quiz packages.' }, { status: 403 })
  try {
    const body = input.parse(await request.json())
    if (body.ids && new Set(body.ids).size !== body.ids.length) return NextResponse.json({ error: 'Duplicate assessment selection.' }, { status: 400 })
    const course = await prisma.classWorkspace.findUnique({ where: { id: body.classId }, select: { id: true } })
    if (!course) return NextResponse.json({ error: 'Course unavailable.' }, { status: 404 })
    const assessments = await prisma.assessment.findMany({
      where: { classWorkspaceId: body.classId, ...(body.latestApproved ? { mode: 'EXAM', status: 'APPROVED' } : { id: { in: body.ids! } }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(body.latestApproved ? { distinct: ['studentId'] as ['studentId'], take: 101 } : {}),
      select: { id: true, mode: true, status: true, from: true, to: true, createdAt: true, questions: true, sources: true, student: { select: { firstName: true, lastName: true } }, classWorkspace: { select: { name: true } } },
    })
    if (body.ids && assessments.length !== body.ids.length) return NextResponse.json({ error: 'One or more selected assessments are unavailable in this course.' }, { status: 404 })
    if (!assessments.length) return NextResponse.json({ error: 'No accepted exams to export. Open a ready exam and choose Accept exam first.' }, { status: 409 })
    if (assessments.length > 100) return NextResponse.json({ error: 'Select at most 100 assessments per download.' }, { status: 400 })
    if (assessments.some(a => !canvasExportable(a))) return NextResponse.json({ error: 'Accept each exam draft before exporting. Practice tests must be ready. No assessments were exported.' }, { status: 409 })
    const zip = buildCanvasExport(assessments as CanvasAssessment[], body.format, body.points)
    const filename = `sanctum-${body.format === 'individual' ? 'individual-quizzes' : 'canvas-qti'}-${assessments.length}.zip`
    return new NextResponse(Buffer.from(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return NextResponse.json({ error: 'The export could not be created. Check the selection and point value; saved questions must pass validation.' }, { status: 400 })
  }
}
