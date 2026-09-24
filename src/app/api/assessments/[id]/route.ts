import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/assessment-prisma.server'
import { assessmentScope, AssessmentError } from '@/lib/assessment-data.server'
import { canReadAssessment, sameQuestions, publicAssessment, scoreAnswers, validateQuestions, type AssessmentQuestion } from '@/lib/assessments'
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const a = await prisma.assessment.findUnique({ where: { id: params.id } })
    if (!a || !canReadAssessment(session.user, a)) throw new Error()
    await assessmentScope(prisma, session.user, a.classWorkspaceId, a.studentId)
    return NextResponse.json(publicAssessment(a, session.user.role === 'ADMIN'), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'Assessment unavailable.' }, { status: 404 }) }
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${params.id} FOR UPDATE`
      const a = await tx.assessment.findUnique({ where: { id: params.id } })
      if (!a || !canReadAssessment(session.user, a)) throw new AssessmentError('Assessment unavailable.', 404)
      await assessmentScope(tx, session.user, a.classWorkspaceId, a.studentId, true)
      if (body.action === 'cancel' && ['QUEUED', 'GENERATING'].includes(a.status)) {
        return tx.assessment.update({ where: { id: a.id }, data: { status: 'FAILED', error: 'Generation canceled.', leaseToken: null, leaseExpiresAt: null } })
      }
      if (body.action === 'submit' && a.mode === 'PRACTICE' && a.studentId === session.user.id && a.status === 'READY' && !a.submittedAt) {
        const score = scoreAnswers(a.questions as unknown as AssessmentQuestion[], body.answers)
        return tx.assessment.update({ where: { id: a.id }, data: { score, answers: body.answers, submittedAt: new Date() } })
      }
      if ((body.action === 'save' || body.action === 'approve') && session.user.role === 'ADMIN' && a.mode === 'EXAM' && a.status === 'READY') {
        const questions = validateQuestions({ questions: body.questions }, (a.sources as unknown as { id: string }[]).map(s => s.id))
        return tx.assessment.update({ where: { id: a.id }, data: { questions: questions as unknown as Prisma.InputJsonValue, approvalMethod: a.approvalMethod === 'EDITED' || !sameQuestions(questions, a.questions) ? 'EDITED' : 'ACCEPTED_DEFAULT', ...(body.action === 'approve' ? { status: 'APPROVED', approvedAt: new Date(), approvedById: session.user.id } : {}) } })
      }
      throw new AssessmentError('This version cannot be changed in its current state.', 409)
    })
    return NextResponse.json(publicAssessment(result, session.user.role === 'ADMIN'))
  } catch (e) { return NextResponse.json({ error: e instanceof AssessmentError ? e.message : 'Invalid answers or questions. Check all 25 questions and try again.' }, { status: e instanceof AssessmentError ? e.status : 400 }) }
}
