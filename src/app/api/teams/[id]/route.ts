import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET - Get a single team
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
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
        tickets: {
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
          orderBy: [{ status: 'asc' }, { position: 'asc' }],
        },
        reflections: {
          orderBy: { weekOf: 'desc' },
          take: 1,
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Check if user has access to this team
    if (session.user.role !== 'ADMIN') {
      const isMember = team.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json(
          { error: 'You do not have access to this team' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error('Failed to get team:', error)
    return NextResponse.json({ error: 'Failed to get team' }, { status: 500 })
  }
}

// PATCH - Update a team (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can update teams' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description } = body

    const team = await prisma.team.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
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
    console.error('Failed to update team:', error)
    return NextResponse.json(
      { error: 'Failed to update team' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a team (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can delete teams' },
        { status: 403 }
      )
    }

    await prisma.team.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete team:', error)
    return NextResponse.json(
      { error: 'Failed to delete team' },
      { status: 500 }
    )
  }
}
