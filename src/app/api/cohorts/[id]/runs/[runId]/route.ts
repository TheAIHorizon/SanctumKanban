import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/cohort/guard'

// PATCH /api/cohorts/[id]/runs/[runId]
// Persists edits from the interactive review board.
// Body: { teams: [{ id?, name, index, isHolding, memberResponseIds: [], leadResponseId? }] }
// Rebuilds the run's ProposedTeams/Members from the provided structure.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const run = await prisma.cohortRun.findUnique({ where: { id: params.runId } })
  if (!run || run.cohortId !== params.id) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const body = await request.json()
  const teams = body.teams as {
    name: string
    index: number
    isHolding?: boolean
    rationale?: string
    memberResponseIds: string[]
    leadResponseId?: string | null
  }[]
  if (!Array.isArray(teams)) {
    return NextResponse.json({ error: 'teams array required' }, { status: 400 })
  }

  // Rebuild: delete existing proposed teams (cascades members), recreate.
  await prisma.proposedTeam.deleteMany({ where: { runId: params.runId } })
  for (const t of teams) {
    await prisma.proposedTeam.create({
      data: {
        runId: params.runId,
        name: t.name,
        index: t.index,
        isHolding: !!t.isHolding,
        rationale: t.rationale || null,
        members: {
          create: t.memberResponseIds.map((rid) => ({
            responseId: rid,
            isLead: rid === t.leadResponseId,
          })),
        },
      },
    })
  }

  const updated = await prisma.cohortRun.findUnique({
    where: { id: params.runId },
    include: {
      teams: { orderBy: { index: 'asc' }, include: { members: { include: { response: true } } } },
    },
  })
  return NextResponse.json({ run: updated })
}
