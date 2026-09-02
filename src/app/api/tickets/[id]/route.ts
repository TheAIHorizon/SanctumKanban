import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { isTeamClassWritable } from '@/lib/class-workspaces.server'

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
    if (!(await isTeamClassWritable(ticket.teamId))) {
      return NextResponse.json({ error: 'Archived class boards are read-only' }, { status: 409 })
    }

    // Check permissions
    const membership = ticket.team.members.find(
      (m) => m.userId === session.user.id
    )
    if (
      !can(
        { id: session.user.id, role: session.user.role as any },
        'ticket:update',
        {
          isMember: !!membership,
          isLead: membership?.role === 'LEAD',
          assigneeId: ticket.assigneeId,
          createdById: ticket.createdById,
        }
      )
    ) {
      return NextResponse.json(
        { error: 'You do not have permission to update this ticket' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, status, assigneeId, position, dueDate, tagIds } = body

    // Track status change for history
    const statusChanged = status && status !== ticket.status

    // Handle tag updates if provided
    if (tagIds !== undefined) {
      // Remove existing tags
      await prisma.ticketTag.deleteMany({
        where: { ticketId: params.id },
      })
      // Add new tags
      if (tagIds.length > 0) {
        await prisma.ticketTag.createMany({
          data: tagIds.map((tagId: string) => ({
            ticketId: params.id,
            tagId,
          })),
        })
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(position !== undefined && { position }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
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

    // Create history entry for status change
    if (statusChanged) {
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          userId: session.user.id,
          action: 'moved',
          fromStatus: ticket.status,
          toStatus: status,
        },
      })
    }

    // Create history entry for assignee change
    if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
      await prisma.ticketHistory.create({
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

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error('Failed to update ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
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
    if (!(await isTeamClassWritable(ticket.teamId))) {
      return NextResponse.json({ error: 'Archived class boards are read-only' }, { status: 409 })
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
      // Permanent deletion is admin-only.
      if (!can(principal, 'ticket:delete-hard', ctx)) {
        return NextResponse.json(
          { error: 'Only an admin can permanently delete a ticket' },
          { status: 403 }
        )
      }
      await prisma.ticket.delete({ where: { id: params.id } })
      return NextResponse.json({ success: true, deleted: 'hard' })
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
