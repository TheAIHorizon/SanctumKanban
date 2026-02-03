import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST - Create a new announcement (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create announcements' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, content, pinned = false } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        pinned,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(announcement)
  } catch (error) {
    console.error('Failed to create announcement:', error)
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    )
  }
}

// GET - Get announcements
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const includeOld = searchParams.get('includeOld') === 'true'

    const where: any = {}

    if (!includeOld) {
      // Only show pinned announcements or recent ones (last 7 days)
      where.OR = [
        { pinned: true },
        {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      ]
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    return NextResponse.json(announcements)
  } catch (error) {
    console.error('Failed to get announcements:', error)
    return NextResponse.json(
      { error: 'Failed to get announcements' },
      { status: 500 }
    )
  }
}
