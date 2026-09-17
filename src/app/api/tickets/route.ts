import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { validateTicketSchedule } from '@/lib/ticket-schedule'
import {
  completionForNewTicket,
  isTicketStatus,
} from '@/lib/ticket-completion'
import { isTransactionConflict } from '@/lib/transaction-conflicts'
import { planStartForNewTicket } from '@/lib/ticket-start'

class TicketCreateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// POST - Create a new ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, teamId, assigneeId, status, tagIds } = body

    if (
      Object.hasOwn(body, 'completedAt') ||
      Object.hasOwn(body, 'startedAt') ||
      Object.hasOwn(body, 'startDateAutoFilled')
    ) {
      return NextResponse.json(
        { error: 'completedAt, startedAt, and startDateAutoFilled are read-only' },
        { status: 400 }
      )
    }

    if (status !== undefined && !isTicketStatus(status)) {
      return NextResponse.json({ error: 'Invalid ticket status' }, { status: 400 })
    }
    const ticketStatus = status ?? 'BACKLOG'

    if (!title || !teamId) {
      return NextResponse.json(
        { error: 'Title and team ID are required' },
        { status: 400 }
      )
    }

    const schedule = validateTicketSchedule(body, {
      startDate: null,
      dueDate: null,
    })
    if (!schedule.ok) {
      return NextResponse.json({ error: schedule.error }, { status: 400 })
    }

    const ticket = await prisma.$transaction(async (tx) => {
      // The team lock serializes creation within a board, including an empty column.
      const teams = await tx.$queryRaw<{ id: string; classWorkspaceId: string | null }[]>`
        SELECT "id", "classWorkspaceId"
        FROM "Team"
        WHERE "id" = ${teamId}
        FOR UPDATE
      `
      const team = teams[0]
      if (!team) {
        throw new TicketCreateError(
          'You do not have permission to create tickets for this team',
          403
        )
      }

      if (team.classWorkspaceId) {
        const workspaces = await tx.$queryRaw<{ archivedAt: Date | null }[]>`
          SELECT "archivedAt"
          FROM "ClassWorkspace"
          WHERE "id" = ${team.classWorkspaceId}
          FOR UPDATE
        `
        if (!workspaces[0]) {
          throw new TicketCreateError(
            'You do not have permission to create tickets for this team',
            403
          )
        }
        if (workspaces[0].archivedAt) {
          throw new TicketCreateError('Archived class boards are read-only', 409)
        }
      }

      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "TeamMember"
        WHERE "teamId" = ${teamId} AND "userId" = ${session.user.id}
        FOR UPDATE
      `
      const membership = await tx.teamMember.findUnique({
        where: { userId_teamId: { userId: session.user.id, teamId } },
        select: { role: true },
      })
      if (!can(
        { id: session.user.id, role: session.user.role as any },
        'ticket:create',
        { isMember: !!membership, isLead: membership?.role === 'LEAD' }
      )) {
        throw new TicketCreateError(
          'You do not have permission to create tickets for this team',
          403
        )
      }

      // If an assignee is specified, lock and re-read their membership too.
      if (assigneeId) {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "TeamMember"
          WHERE "teamId" = ${teamId} AND "userId" = ${assigneeId}
          FOR UPDATE
        `
        const assigneeMembership = await tx.teamMember.findUnique({
          where: { userId_teamId: { userId: assigneeId, teamId } },
          select: { role: true },
        })
        if (!assigneeMembership) {
          throw new TicketCreateError('Assignee must be a member of this team', 400)
        }
      }

      const highestPosition = await tx.ticket.findFirst({
        where: { teamId, status: ticketStatus },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      const now = new Date()
      const completedAt = completionForNewTicket(ticketStatus, now)
      const startPlan = planStartForNewTicket(ticketStatus, schedule.schedule.startDate, now)
      const historyDetails = {
        ...(completedAt && { completedAt: completedAt.toISOString() }),
        ...startPlan.historyDetails,
      }
      // Transaction-scoped equivalent of prisma.ticket.create keeps history atomic.
      const created = await tx.ticket.create({
        data: {
          title,
          description,
          teamId,
          assigneeId: assigneeId || null,
          status: ticketStatus,
          position: (highestPosition?.position || 0) + 1,
          createdById: session.user.id,
          startDate: schedule.updates.startDate,
          ...(startPlan.startDate !== schedule.updates.startDate && {
            startDate: startPlan.startDate,
          }),
          startedAt: startPlan.startedAt,
          startDateAutoFilled: startPlan.startDateAutoFilled,
          dueDate: schedule.updates.dueDate,
          completedAt,
          ...(tagIds && tagIds.length > 0 && {
            tags: {
              create: tagIds.map((tagId: string) => ({ tagId })),
            },
          }),
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
          tags: {
            include: {
              tag: true,
            },
          },
        },
      })

      await tx.ticketHistory.create({
        data: {
          ticketId: created.id,
          userId: session.user.id,
          action: 'created',
          toStatus: created.status,
          ...(Object.keys(historyDetails).length > 0 && {
            details: JSON.stringify(historyDetails),
          }),
        },
      })

      return created
    })

    return NextResponse.json(ticket)
  } catch (error) {
    if (error instanceof TicketCreateError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (isTransactionConflict(error)) {
      return NextResponse.json(
        { error: 'Ticket changed concurrently; reload and try again' },
        { status: 409 }
      )
    }
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
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const where: any = {}

    if (teamId) where.teamId = teamId
    if (assigneeId) where.assigneeId = assigneeId
    if (status) where.status = status

    // All authenticated principals (including observers) may read tickets
    // across every team. Archived tickets are hidden unless an admin asks.
    if (!(includeArchived && session.user.role === 'ADMIN')) {
      where.archived = false
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
        tags: {
          include: {
            tag: true,
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
