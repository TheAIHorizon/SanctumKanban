import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeAlignment } from '@/lib/dcwf-alignment'

// GET /api/users/[id]/report?teamId=&from=&to=&inScopeOnly=true
// Full per-student report: profile, activity timeline, logged DCWF tasks (with
// reflection notes), and work-role alignment.
//
// Authz: a student may view their OWN report. ADMIN may view anyone. A TEAM_LEAD
// may view reports for members of a team they lead.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const targetId = params.id
    // Observers may never view individual student reports.
    if (session.user.role === 'OBSERVER') {
      return NextResponse.json(
        { error: 'Observers cannot view individual reports' },
        { status: 403 }
      )
    }
    const isSelf = session.user.id === targetId
    const isAdmin = session.user.role === 'ADMIN'

    // Team-lead access: allowed if the target shares a team the requester leads.
    let isLeadOfTarget = false
    if (!isSelf && !isAdmin) {
      const leadTeams = await prisma.teamMember.findMany({
        where: { userId: session.user.id, role: 'LEAD' },
        select: { teamId: true },
      })
      if (leadTeams.length) {
        const shared = await prisma.teamMember.findFirst({
          where: { userId: targetId, teamId: { in: leadTeams.map((t) => t.teamId) } },
        })
        isLeadOfTarget = Boolean(shared)
      }
    }

    if (!isSelf && !isAdmin && !isLeadOfTarget) {
      return NextResponse.json(
        { error: 'You do not have permission to view this report' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId') || undefined
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    const from = fromStr ? new Date(fromStr) : undefined
    const to = toStr ? new Date(toStr) : undefined
    const inScopeOnly = searchParams.get('inScopeOnly') === 'true'

    // Profile
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        color: true,
        role: true,
        teamMemberships: {
          select: { role: true, team: { select: { id: true, name: true } } },
        },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Activity timeline (ticket history by/for the user)
    const historyWhere: any = {
      OR: [{ userId: targetId }, { ticket: { assigneeId: targetId } }],
    }
    if (from || to) {
      historyWhere.timestamp = {}
      if (from) historyWhere.timestamp.gte = from
      if (to) historyWhere.timestamp.lte = to
    }
    if (teamId) historyWhere.ticket = { ...(historyWhere.ticket || {}), teamId }

    const timeline = await prisma.ticketHistory.findMany({
      where: historyWhere,
      include: {
        ticket: { select: { id: true, title: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    })

    // Logged DCWF tasks with reflection notes
    const taskLinkWhere: any = { createdById: targetId }
    if (from || to) {
      taskLinkWhere.createdAt = {}
      if (from) taskLinkWhere.createdAt.gte = from
      if (to) taskLinkWhere.createdAt.lte = to
    }
    if (teamId) taskLinkWhere.ticket = { teamId }

    const taskLinks = await prisma.ticketDcwfTask.findMany({
      where: taskLinkWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        note: true,
        createdAt: true,
        ticket: { select: { id: true, title: true, team: { select: { name: true } } } },
        ksat: {
          select: {
            ksatId: true,
            description: true,
            roles: {
              select: {
                coreOrAdditional: true,
                workRole: { select: { code: true, title: true, inScope: true } },
              },
            },
          },
        },
      },
    })

    // Alignment
    const alignment = await computeAlignment({ userId: targetId, teamId, from, to, inScopeOnly })

    return NextResponse.json({ user, timeline, taskLinks, alignment })
  } catch (error) {
    console.error('Failed to build user report:', error)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }
}
