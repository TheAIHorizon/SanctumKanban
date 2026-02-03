import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tags - Get all tags (global + team-specific)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    // Get global tags and team-specific tags if teamId provided
    const where = teamId
      ? { OR: [{ teamId: null }, { teamId }] }
      : { teamId: null }

    const tags = await prisma.tag.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(tags)
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and team leads can create tags
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TEAM_LEAD') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, color, teamId } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // If team-specific, verify user has access
    if (teamId && session.user.role !== 'ADMIN') {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: session.user.id,
            teamId,
          },
        },
      })

      if (!membership || membership.role !== 'LEAD') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#6b7280',
        teamId: teamId || null,
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error('Failed to create tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
