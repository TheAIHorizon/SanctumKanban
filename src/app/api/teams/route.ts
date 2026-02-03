import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST - Create a new team (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create teams' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, memberIds, leadId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      )
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
        members: {
          create: [
            // Add lead if specified
            ...(leadId
              ? [{ userId: leadId, role: 'LEAD' as const }]
              : []),
            // Add other members
            ...(memberIds || [])
              .filter((id: string) => id !== leadId)
              .map((userId: string) => ({
                userId,
                role: 'MEMBER' as const,
              })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                color: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(team)
  } catch (error) {
    console.error('Failed to create team:', error)
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    )
  }
}

// GET - Get all teams
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let teams

    if (session.user.role === 'ADMIN') {
      // Admins can see all teams
      teams = await prisma.team.findMany({
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  color: true,
                },
              },
            },
          },
          _count: {
            select: { tickets: true },
          },
        },
        orderBy: { name: 'asc' },
      })
    } else {
      // Non-admins can only see their teams
      teams = await prisma.team.findMany({
        where: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  color: true,
                },
              },
            },
          },
          _count: {
            select: { tickets: true },
          },
        },
        orderBy: { name: 'asc' },
      })
    }

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Failed to get teams:', error)
    return NextResponse.json(
      { error: 'Failed to get teams' },
      { status: 500 }
    )
  }
}
