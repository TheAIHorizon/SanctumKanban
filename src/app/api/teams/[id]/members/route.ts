import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST - Add a member to a team
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const team = await prisma.team.findUnique({
      where: { id: params.id },
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
        { error: 'You do not have permission to add members to this team' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, role = 'MEMBER' } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMember = team.members.find((m) => m.userId === userId)
    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      )
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: params.id,
        userId,
        role,
      },
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
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Failed to add team member:', error)
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a member from a team
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check permissions
    const team = await prisma.team.findUnique({
      where: { id: params.id },
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
        { error: 'You do not have permission to remove members from this team' },
        { status: 403 }
      )
    }

    await prisma.teamMember.delete({
      where: {
        userId_teamId: {
          userId,
          teamId: params.id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove team member:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}
