import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST - Create a new ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, teamId, assigneeId, status } = body

    if (!title || !teamId) {
      return NextResponse.json(
        { error: 'Title and team ID are required' },
        { status: 400 }
      )
    }

    // Check if user has permission to create tickets for this team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    })

    const isAdmin = session.user.role === 'ADMIN'
    const isTeamLead = membership?.role === 'LEAD'

    if (!isAdmin && !isTeamLead) {
      return NextResponse.json(
        { error: 'You do not have permission to create tickets for this team' },
        { status: 403 }
      )
    }

    // Get the highest position in the column
    const highestPosition = await prisma.ticket.findFirst({
      where: { teamId, status: status || 'BACKLOG' },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        teamId,
        assigneeId: assigneeId || null,
        status: status || 'BACKLOG',
        position: (highestPosition?.position || 0) + 1,
        createdById: session.user.id,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
      },
    })

    // Create ticket history entry
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        userId: session.user.id,
        action: 'created',
        toStatus: ticket.status,
      },
    })

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Failed to create ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    )
  }
}

// GET - Get tickets (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const assigneeId = searchParams.get('assigneeId')
    const status = searchParams.get('status')

    const where: any = {}

    if (teamId) where.teamId = teamId
    if (assigneeId) where.assigneeId = assigneeId
    if (status) where.status = status

    // Non-admins can only see tickets from their teams
    if (session.user.role !== 'ADMIN') {
      const userTeams = await prisma.teamMember.findMany({
        where: { userId: session.user.id },
        select: { teamId: true },
      })
      where.teamId = { in: userTeams.map((t) => t.teamId) }
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Failed to get tickets:', error)
    return NextResponse.json(
      { error: 'Failed to get tickets' },
      { status: 500 }
    )
  }
}
