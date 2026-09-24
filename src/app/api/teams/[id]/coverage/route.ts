import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeTeamCoverage } from '@/lib/dcwf-alignment'

// GET /api/teams/[id]/coverage
// Team-level DCWF role coverage: which in-scope roles the team is touching,
// who contributes to each, per-member breakdown, and uncovered role gaps.
// Authz: ADMIN, or a LEAD/member of the team.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    if (!isAdmin) {
      const membership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: session.user.id, teamId: params.id } },
      })
      if (!membership) {
        return NextResponse.json({ error: 'You do not have access to this team' }, { status: 403 })
      }
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const coverage = await computeTeamCoverage(params.id)
    return NextResponse.json({ team, coverage })
  } catch (error) {
    console.error('Failed to compute team coverage:', error)
    return NextResponse.json({ error: 'Failed to compute team coverage' }, { status: 500 })
  }
}
