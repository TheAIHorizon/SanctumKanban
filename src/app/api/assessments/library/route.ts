import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/assessment-prisma.server'
import { AssessmentError } from '@/lib/assessment-data.server'
import { libraryQuerySchema, libraryWhere, assessmentSummarySelect } from '@/lib/assessment-library.server'
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const query = libraryQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
    const where = await libraryWhere(prisma, session.user, query)
    const pageSize = 25
    const [total, items] = await prisma.$transaction([
      prisma.assessment.count({ where }),
      prisma.assessment.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * pageSize, take: pageSize, select: assessmentSummarySelect }),
    ])
    return NextResponse.json({ total, page: query.page, pageSize, items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof AssessmentError ? error.message : 'Invalid library filter or service unavailable.' }, { status: error instanceof AssessmentError ? error.status : 400 })
  }
}
