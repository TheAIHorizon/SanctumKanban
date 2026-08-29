import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/cohort/guard'
import { solve, MODE_PRESETS, type Student, type Weights } from '@/lib/cohort/solver'
import { generateTeamRationale, computeWatchList } from '@/lib/cohort/rationale'

// POST /api/cohorts/[id]/solve
// Body: { mode?, weights?, seed?, teamSize?, ai? (default true) }
// Runs the deterministic solver, optionally decorates with AI rationale,
// persists a CohortRun + ProposedTeams, and returns the full proposal.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cohort = await prisma.cohort.findUnique({
    where: { id: params.id },
    include: { responses: true },
  })
  if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })
  if (cohort.responses.length < 3) {
    return NextResponse.json({ error: 'Need at least 3 responses to form teams' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const mode: string = body.mode || 'parity'
  const weights: Weights = body.weights || MODE_PRESETS[mode] || MODE_PRESETS.parity
  const seed: number = Number.isFinite(body.seed) ? body.seed : 42
  const teamSize: number = body.teamSize && body.teamSize >= 2 ? body.teamSize : cohort.teamSize
  const useAi: boolean = body.ai !== false

  // Map responses -> solver Students (id = response.id so we can map back).
  const students: Student[] = cohort.responses.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    skills: (r.skills as any) || {},
    aspirationRole: r.aspirationRole,
    leadership: (r.leadership as any) || null,
    availDays: (r.availDays as any) || [],
    timePref: r.timePref,
    workStyle: r.workStyle,
    partnerRequest: r.partnerRequest,
    antiPartner: r.antiPartner,
  }))

  const result = solve(students, { teamSize, weights, seed })
  const watchList = computeWatchList(result, students)

  // Rationales (AI or template fallback). Local models contend on a single
  // GPU, so run with limited concurrency (not all-at-once) — each call then
  // completes reliably instead of starving. Generous per-call timeout too.
  let rationales: { text: string; usedAi: boolean }[] = []
  let anyAi = false
  if (useAi) {
    rationales = new Array(result.teams.length)
    const CONCURRENCY = 2
    let cursor = 0
    const worker = async () => {
      while (cursor < result.teams.length) {
        const i = cursor++
        rationales[i] = await generateTeamRationale(result.teams[i], students)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, result.teams.length) }, worker))
    anyAi = rationales.some((r) => r.usedAi)
  } else {
    rationales = result.teams.map(() => ({ text: '', usedAi: false }))
  }

  // Persist the run.
  const run = await prisma.cohortRun.create({
    data: {
      cohortId: cohort.id,
      mode,
      weights: weights as any,
      seed,
      score: result.score,
      metrics: result.metrics as any,
      watchList: watchList as any,
      teams: {
        create: result.teams.map((t, i) => ({
          name: t.isHolding ? 'Holding team' : `Team ${t.index + 1}`,
          index: t.index,
          isHolding: t.isHolding,
          rationale: rationales[i]?.text || null,
          metrics: t.metrics as any,
          members: {
            create: t.memberIds.map((rid, j) => ({
              responseId: rid,
              isLead: false,
              teamRole: null,
            })),
          },
        })),
      },
    },
    include: {
      teams: { include: { members: { include: { response: true } } }, orderBy: { index: 'asc' } },
    },
  })

  return NextResponse.json({ run, usedAi: anyAi, metrics: result.metrics }, { status: 201 })
}
