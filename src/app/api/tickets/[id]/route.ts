import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

    // Check permissions
    const isAdmin = session.user.role === 'ADMIN'
    const membership = ticket.team.members.find(
      (m) => m.userId === session.user.id
    )
    const isTeamLead = membership?.role === 'LEAD'
    const isAssignee = ticket.assigneeId === session.user.id

    if (!isAdmin && !isTeamLead && !isAssignee) {
      return NextResponse.json(
        { error: 'You do not have permission to update this ticket' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, status, assigneeId, position } = body

    // Track status change for history
    const statusChanged = status && status !== ticket.status

    const updatedTicket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(position !== undefined && { position }),
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

// DELETE - Delete a ticket
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

    // Check permissions - only admins and team leads can delete
    const isAdmin = session.user.role === 'ADMIN'
    const membership = ticket.team.members.find(
      (m) => m.userId === session.user.id
    )
    const isTeamLead = membership?.role === 'LEAD'

    if (!isAdmin && !isTeamLead) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this ticket' },
        { status: 403 }
      )
    }

    await prisma.ticket.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete ticket:', error)
    return NextResponse.json(
      { error: 'Failed to delete ticket' },
      { status: 500 }
    )
  }
}
