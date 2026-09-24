import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/assessment-prisma.server'
import { assessmentScope, queueAssessment, AssessmentError } from '@/lib/assessment-data.server'
import { publicAssessment } from '@/lib/assessments'
const input = z.object({ classId: z.string().min(1).max(100), studentId: z.string().min(1).max(100), from: z.string(), to: z.string(), mode: z.enum(['PRACTICE', 'EXAM']), references: z.string().max(20000).optional() })
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = input.parse(await request.json())
    const assessment = await queueAssessment(prisma, session.user, body)
    return NextResponse.json(publicAssessment(assessment, session.user.role === 'ADMIN'), { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof AssessmentError ? e.message : 'Invalid request or assessment service unavailable.' }, { status: e instanceof AssessmentError ? e.status : 400 })
  }
}
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const classId = request.nextUrl.searchParams.get('classId') || '', studentId = request.nextUrl.searchParams.get('studentId') || session.user.id
  try {
    await assessmentScope(prisma, session.user, classId, studentId)
    const assessments = await prisma.assessment.findMany({ where: { classWorkspaceId: classId, studentId, ...(session.user.role === 'ADMIN' ? {} : { mode: 'PRACTICE' }) }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, mode: true, status: true, from: true, to: true, createdAt: true, submittedAt: true, score: true, error: true } })
    return NextResponse.json(assessments, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'Assessments unavailable.' }, { status: 404 }) }
}
