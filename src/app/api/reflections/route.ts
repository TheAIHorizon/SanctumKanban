import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getWeekStart } from '@/lib/utils'

// POST - Create or update a reflection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, wentWell, couldImprove, actionItems, weekOf } = body

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      )
    }

    // Check permissions
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    const isTeamLead = team.members.some(
      (m) => m.userId === session.user.id && m.role === 'LEAD'
    )

    if (!isAdmin && !isTeamLead) {
      return NextResponse.json(
        { error: 'Only team leads can update reflections' },
        { status: 403 }
      )
    }

    const weekStart = weekOf ? new Date(weekOf) : getWeekStart()

    // Upsert the reflection
    const reflection = await prisma.reflection.upsert({
      where: {
        teamId_weekOf: {
          teamId,
          weekOf: weekStart,
        },
      },
      create: {
        teamId,
        weekOf: weekStart,
        wentWell,
        couldImprove,
        actionItems,
      },
      update: {
        wentWell,
        couldImprove,
        actionItems,
      },
    })

    return NextResponse.json(reflection)
  } catch (error) {
    console.error('Failed to save reflection:', error)
    return NextResponse.json(
      { error: 'Failed to save reflection' },
      { status: 500 }
    )
  }
}

// GET - Get reflections for a team
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      )
    }

    // Check if user has access to this team
    if (session.user.role !== 'ADMIN') {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: session.user.id,
            teamId,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'You do not have access to this team' },
          { status: 403 }
        )
      }
    }

    const reflections = await prisma.reflection.findMany({
      where: { teamId },
      orderBy: { weekOf: 'desc' },
      take: limit,
    })

    return NextResponse.json(reflections)
  } catch (error) {
    console.error('Failed to get reflections:', error)
    return NextResponse.json(
      { error: 'Failed to get reflections' },
      { status: 500 }
    )
  }
}
