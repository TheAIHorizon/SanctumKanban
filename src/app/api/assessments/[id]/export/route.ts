import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/assessment-prisma.server'
import { assessmentScope } from '@/lib/assessment-data.server'
import { type AssessmentQuestion } from '@/lib/assessments'
import { escapeHtml as e, printableDocument } from '@/lib/team-export'
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const a = await prisma.assessment.findUnique({ where: { id: params.id } })
  if (!a || a.mode !== 'EXAM' || a.status !== 'APPROVED') return NextResponse.json({ error: 'Accept the exam draft before exporting.' }, { status: 409 })
  try { await assessmentScope(prisma, session.user, a.classWorkspaceId, a.studentId) } catch { return NextResponse.json({ error: 'Exam unavailable.' }, { status: 404 }) }
  const student = await prisma.user.findUnique({ where: { id: a.studentId }, select: { firstName: true, lastName: true } })
  const key = request.nextUrl.searchParams.get('key') === '1'
  const questions = a.questions as unknown as AssessmentQuestion[]
  const html = printableDocument(key ? 'Instructor answer key' : 'Course exam', `<h1>${key ? 'Instructor answer key — keep separate' : 'Course exam'}</h1><p>${e(student?.firstName)} ${e(student?.lastName)} · Work range: ${e(a.from)} to ${e(a.to)} · Version ${e(a.id)}</p><p>${key ? `Accepted ${e(a.approvedAt?.toISOString().slice(0, 10))}. Method: ${e(a.approvalMethod)}. AI-generated content may contain errors.` : 'Select one best answer for each question.'}</p>${questions.map((q, i) => `<article class="ticket"><h2>${i + 1}. ${e(q.stem)}</h2>${q.options.map((o, j) => `<p>${'ABCD'[j]}. ${e(o)}</p>`).join('')}${key ? `<p><b>Answer: ${'ABCD'[q.correctIndex]}</b> — ${e(q.explanation)}</p>` : ''}</article>`).join('')}`, 'letter')
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="exam-${key ? 'key' : 'student'}.html"`, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } })
}
