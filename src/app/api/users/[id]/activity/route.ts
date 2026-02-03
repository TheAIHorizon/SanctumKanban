import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET - Get user activity (ticket history)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const teamId = searchParams.get('teamId')

    // Build query conditions
    const where: any = {
      OR: [
        { userId: params.id }, // Actions performed by user
        { ticket: { assigneeId: params.id } }, // Actions on tickets assigned to user
      ],
    }

    if (fromDate) {
      where.timestamp = { ...where.timestamp, gte: new Date(fromDate) }
    }

    if (toDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(toDate) }
    }

    if (teamId) {
      where.ticket = { ...where.ticket, teamId }
    }

    const activity = await prisma.ticketHistory.findMany({
      where,
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    // Also get summary stats
    const stats = await prisma.ticketHistory.groupBy({
      by: ['action'],
      where: { userId: params.id },
      _count: true,
    })

    const ticketsCreated = stats.find((s) => s.action === 'created')?._count || 0
    const ticketsMoved = stats.find((s) => s.action === 'moved')?._count || 0

    const ticketsCompleted = await prisma.ticketHistory.count({
      where: {
        userId: params.id,
        action: 'moved',
        toStatus: 'DONE',
      },
    })

    return NextResponse.json({
      activity,
      stats: {
        ticketsCreated,
        ticketsMoved,
        ticketsCompleted,
      },
    })
  } catch (error) {
    console.error('Failed to get user activity:', error)
    return NextResponse.json(
      { error: 'Failed to get user activity' },
      { status: 500 }
    )
  }
}
