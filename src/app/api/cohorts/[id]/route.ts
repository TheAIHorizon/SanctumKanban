import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/cohort/guard'

// GET /api/cohorts/[id] — cohort + responses + most recent run (full proposal)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cohort = await prisma.cohort.findUnique({
    where: { id: params.id },
    include: {
      responses: { orderBy: { lastName: 'asc' } },
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          teams: {
            orderBy: { index: 'asc' },
            include: { members: { include: { response: true } } },
          },
        },
      },
    },
  })
  if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })
  return NextResponse.json({ cohort, latestRun: cohort.runs[0] || null })
}

// DELETE /api/cohorts/[id] — remove a cohort and its runs (admin)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.cohort.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
