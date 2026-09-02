import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isTeamClassWritable } from '@/lib/class-workspaces.server'

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
        classWorkspace: {
          include: { members: { select: { userId: true } } },
        },
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
          where: { archived: false },
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

    // Any enrolled class member can read every team in that class.
    if (!['ADMIN', 'OBSERVER'].includes(session.user.role)) {
      const isClassMember = team.classWorkspace?.members.some(
        (member) => member.userId === session.user.id
      )
      if (!isClassMember) {
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
    if (!(await isTeamClassWritable(params.id))) {
      return NextResponse.json({ error: 'Archived class boards are read-only' }, { status: 409 })
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
    if (!(await isTeamClassWritable(params.id))) {
      return NextResponse.json({ error: 'Archived class boards are read-only' }, { status: 409 })
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
