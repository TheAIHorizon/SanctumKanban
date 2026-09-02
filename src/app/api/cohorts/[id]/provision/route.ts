import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/cohort/guard'

// POST /api/cohorts/[id]/provision
// Body: { runId }
// Turns a proposed run into REAL Teams + student accounts + memberships.
// Idempotent-ish: skips users that already exist (by email); reuses them.
// Temp password policy (testing): "changeme123" — students change on first login.
const TEMP_PASSWORD = process.env.COHORT_TEMP_PASSWORD || 'changeme123'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { runId } = await request.json().catch(() => ({}))
  if (!runId) return NextResponse.json({ error: 'runId is required' }, { status: 400 })

  const run = await prisma.cohortRun.findUnique({
    where: { id: runId },
    include: {
      cohort: true,
      teams: { include: { members: { include: { response: true } } }, orderBy: { index: 'asc' } },
    },
  })
  if (!run || run.cohortId !== params.id) {
    return NextResponse.json({ error: 'Run not found for this cohort' }, { status: 404 })
  }
  if (!run.cohort.classWorkspaceId) {
    return NextResponse.json({ error: 'Assign this cohort to an active class before provisioning' }, { status: 400 })
  }
  const workspace = await prisma.classWorkspace.findUnique({
    where: { id: run.cohort.classWorkspaceId },
    select: { id: true, archivedAt: true },
  })
  if (!workspace || workspace.archivedAt) {
    return NextResponse.json({ error: 'Cannot provision into an archived class' }, { status: 409 })
  }

  const pwHash = await bcrypt.hash(TEMP_PASSWORD, 12)
  const palette = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
  let colorIdx = 0

  const created: { teams: number; users: number; reused: number } = { teams: 0, users: 0, reused: 0 }

  for (const pteam of run.teams) {
    if (!pteam.members.length) continue // skip empty holding

    const team = await prisma.team.create({
      data: {
        name: `${run.cohort.name} — ${pteam.name}`,
        description: pteam.rationale?.slice(0, 500) || null,
        classWorkspaceId: workspace.id,
      },
    })
    created.teams++

    for (const pm of pteam.members) {
      const r = pm.response
      // Reuse existing user by email, else create with temp password.
      let user = await prisma.user.findUnique({ where: { email: r.email || `${r.firstName}.${r.lastName}@example.edu` } })
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: r.email || `${r.firstName}.${r.lastName}`.toLowerCase().replace(/\s+/g, '') + '@example.edu',
            passwordHash: pwHash,
            firstName: r.firstName,
            lastName: r.lastName,
            role: 'MEMBER',
            color: palette[colorIdx++ % palette.length],
          },
        })
        created.users++
      } else {
        created.reused++
      }

      // Link the response to the provisioned user.
      await prisma.surveyResponse.update({
        where: { id: r.id },
        data: { provisionedUserId: user.id },
      })

      // Membership (lead flag from ProposedMember).
      await prisma.teamMember.upsert({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
        update: { role: pm.isLead ? 'LEAD' : 'MEMBER' },
        create: { userId: user.id, teamId: team.id, role: pm.isLead ? 'LEAD' : 'MEMBER' },
      })
      await prisma.classWorkspaceMember.upsert({
        where: {
          classWorkspaceId_userId: {
            classWorkspaceId: workspace.id,
            userId: user.id,
          },
        },
        update: {},
        create: { classWorkspaceId: workspace.id, userId: user.id },
      })

      // Promote a lead's global role to TEAM_LEAD (if currently MEMBER).
      if (pm.isLead && user.role === 'MEMBER') {
        await prisma.user.update({ where: { id: user.id }, data: { role: 'TEAM_LEAD' } })
      }
    }
  }

  await prisma.cohort.update({ where: { id: params.id }, data: { provisioned: true } })

  return NextResponse.json({
    success: true,
    created,
    tempPassword: TEMP_PASSWORD,
    note: 'Students created with a temporary password; have them change it on first login.',
  })
}
