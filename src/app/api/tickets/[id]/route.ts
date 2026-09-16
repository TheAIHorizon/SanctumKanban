import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { isTeamClassWritable } from '@/lib/class-workspaces.server'
import { validateTicketSchedule } from '@/lib/ticket-schedule'
import {
  isTicketStatus,
  planCompletionTransition,
  type TicketStatusValue,
} from '@/lib/ticket-completion'
import { isTransactionConflict } from '@/lib/transaction-conflicts'

class TicketUpdateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// GET - Get a single ticket
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
            email: true,
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
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                color: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { timestamp: 'desc' },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Reading is allowed for any authenticated principal across all teams
    // (cross-team visibility). Write actions remain gated in PATCH/DELETE.

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Failed to get ticket:', error)
    return NextResponse.json(
      { error: 'Failed to get ticket' },
      { status: 500 }
    )
  }
}

// PATCH - Update a ticket
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, any>
  try {
    body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { title, description, status, assigneeId, tagIds } = body
  if (Object.hasOwn(body, 'completedAt')) {
    return NextResponse.json({ error: 'completedAt is read-only' }, { status: 400 })
  }
  if (status !== undefined && !isTicketStatus(status)) {
    return NextResponse.json({ error: 'Invalid ticket status' }, { status: 400 })
  }

  if (tagIds !== undefined && !Array.isArray(tagIds)) {
    return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 })
  }

  try {
    const updatedTicket = await prisma.$transaction(async (tx) => {
      const lockedTickets = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "Ticket"
        WHERE "id" = ${params.id}
        FOR UPDATE
      `
      if (!lockedTickets[0]) throw new TicketUpdateError('Ticket not found', 404)

      // Re-read every mutable authorization and transition fact after the lock.
      const ticket = await tx.ticket.findUnique({ where: { id: params.id } })
      if (!ticket) throw new TicketUpdateError('Ticket not found', 404)
      if (ticket.archived) {
        throw new TicketUpdateError('Archived tickets are read-only', 409)
      }

      const teams = await tx.$queryRaw<{ id: string; classWorkspaceId: string | null }[]>`
        SELECT "id", "classWorkspaceId"
        FROM "Team"
        WHERE "id" = ${ticket.teamId}
        FOR UPDATE
      `
      const team = teams[0]
      if (!team) throw new TicketUpdateError('Ticket not found', 404)

      if (team.classWorkspaceId) {
        const workspaces = await tx.$queryRaw<{ archivedAt: Date | null }[]>`
          SELECT "archivedAt"
          FROM "ClassWorkspace"
          WHERE "id" = ${team.classWorkspaceId}
          FOR UPDATE
        `
        if (!workspaces[0]) throw new TicketUpdateError('Ticket not found', 404)
        if (workspaces[0].archivedAt) {
          throw new TicketUpdateError('Archived class boards are read-only', 409)
        }
      }

      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "TeamMember"
        WHERE "teamId" = ${ticket.teamId} AND "userId" = ${session.user.id}
        FOR UPDATE
      `
      const membership = await tx.teamMember.findUnique({
        where: {
          userId_teamId: { userId: session.user.id, teamId: ticket.teamId },
        },
        select: { role: true },
      })
      if (!can(
        { id: session.user.id, role: session.user.role as any },
        'ticket:update',
        {
          isMember: !!membership,
          isLead: membership?.role === 'LEAD',
          assigneeId: ticket.assigneeId,
          createdById: ticket.createdById,
        }
      )) {
        throw new TicketUpdateError('You do not have permission to update this ticket', 403)
      }
      if (body.position !== undefined) {
        throw new TicketUpdateError('Use the reorder endpoint to change ticket positions', 400)
      }

      const schedule = validateTicketSchedule(body, {
        startDate: ticket.startDate,
        dueDate: ticket.dueDate,
      })
      if (!schedule.ok) throw new TicketUpdateError(schedule.error, 400)

      const requestedStatus = status as TicketStatusValue | undefined
      const statusChanged = requestedStatus !== undefined && requestedStatus !== ticket.status
      const completionPlan = planCompletionTransition(
        ticket.status,
        ticket.completedAt,
        requestedStatus,
        new Date(),
      )

      // Atomic equivalents of prisma.ticketTag.deleteMany and prisma.ticket.update follow.
      // Tags participate in the same transaction, so later failures cannot lose them.
      if (tagIds !== undefined) {
        await tx.ticketTag.deleteMany({ where: { ticketId: params.id } })
        if (tagIds.length > 0) {
          await tx.ticketTag.createMany({
            data: tagIds.map((tagId: string) => ({ ticketId: params.id, tagId })),
          })
        }
      }

      const result = await tx.ticket.update({
        where: { id: params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(requestedStatus !== undefined && { status: requestedStatus }),
          ...(assigneeId !== undefined && { assigneeId }),
          ...schedule.updates,
          ...(completionPlan.shouldWrite && { completedAt: completionPlan.completedAt }),
        },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, color: true },
          },
          tags: { include: { tag: true } },
        },
      })

      if (statusChanged) {
        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            userId: session.user.id,
            action: 'moved',
            fromStatus: ticket.status,
            toStatus: requestedStatus,
            ...(completionPlan.historyDetails && {
              details: JSON.stringify(completionPlan.historyDetails),
            }),
          },
        })
      }

      if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            userId: session.user.id,
            action: 'assigned',
            details: JSON.stringify({
              previousAssignee: ticket.assigneeId,
              newAssignee: assigneeId,
            }),
          },
        })
      }

      return result
    })

    return NextResponse.json(updatedTicket)
  } catch (error) {
    if (error instanceof TicketUpdateError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (isTransactionConflict(error)) {
      return NextResponse.json(
        { error: 'Ticket changed concurrently; reload and try again' },
        { status: 409 }
      )
    }
    console.error('Failed to update ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}

// DELETE - Archive a ticket (soft-delete). Admins may hard-delete with ?hard=true.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        team: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    const principal = { id: session.user.id, role: session.user.role as any }
    const membership = ticket.team.members.find(
      (m) => m.userId === session.user.id
    )
    const ctx = {
      isMember: !!membership,
      isLead: membership?.role === 'LEAD',
      assigneeId: ticket.assigneeId,
      createdById: ticket.createdById,
    }

    const hard = new URL(request.url).searchParams.get('hard') === 'true'

    if (hard) {
      // Permanent deletion is admin-only, including for archived tickets.
      if (!can(principal, 'ticket:delete-hard', ctx)) {
        return NextResponse.json(
          { error: 'Only an admin can permanently delete a ticket' },
          { status: 403 }
        )
      }
      if (!(await isTeamClassWritable(ticket.teamId))) {
        return NextResponse.json({ error: 'Archived class boards are read-only' }, { status: 409 })
      }
      await prisma.ticket.delete({ where: { id: params.id } })
      return NextResponse.json({ success: true, deleted: 'hard' })
    }

    if (ticket.archived) {
      return NextResponse.json({ error: 'Archived tickets are read-only' }, { status: 409 })
    }
    if (!(await isTeamClassWritable(ticket.teamId))) {
      return NextResponse.json({ error: 'Archived class boards are read-only' }, { status: 409 })
    }

    // Soft-delete (archive): team lead or the ticket's creator (admin always).
    if (!can(principal, 'ticket:archive', ctx)) {
      return NextResponse.json(
        { error: 'You do not have permission to archive this ticket' },
        { status: 403 }
      )
    }

    const archived = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        archived: true,
        archivedAt: new Date(),
        archivedById: session.user.id,
      },
    })

    // Record the archive in ticket history for the activity timeline.
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        userId: session.user.id,
        action: 'archived',
      },
    })

    return NextResponse.json({ success: true, deleted: 'archived', ticket: archived })
  } catch (error) {
    console.error('Failed to archive ticket:', error)
    return NextResponse.json(
      { error: 'Failed to archive ticket' },
      { status: 500 }
    )
  }
}
