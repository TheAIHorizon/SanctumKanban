import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tickets/[id]/comments - Get comments for a ticket
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId: params.id },
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
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

// POST /api/tickets/[id]/comments - Add a comment to a ticket
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Verify ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: { team: { include: { members: true } } },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if user is admin or team member
    const isAdmin = session.user.role === 'ADMIN'
    const isMember = ticket.team.members.some(m => m.userId === session.user.id)

    if (!isAdmin && !isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        ticketId: params.id,
        authorId: session.user.id,
      },
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
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Failed to create comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
