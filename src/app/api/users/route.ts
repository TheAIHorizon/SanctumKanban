import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateRandomColor } from '@/lib/utils'

// POST - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create users' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, firstName, lastName, contactInfo, role, color } = body

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        contactInfo,
        role: role || 'MEMBER',
        color: color || generateRandomColor(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        contactInfo: true,
        role: true,
        color: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// GET - Get all users (admin only, or filtered for team members)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    let users

    if (session.user.role === 'ADMIN') {
      // Admins can see all users
      users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          contactInfo: true,
          role: true,
          color: true,
          createdAt: true,
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })
    } else if (teamId) {
      // Non-admins can see members of their teams
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
          { error: 'You are not a member of this team' },
          { status: 403 }
        )
      }

      users = await prisma.user.findMany({
        where: {
          teamMemberships: {
            some: {
              teamId,
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          color: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })
    } else {
      return NextResponse.json(
        { error: 'Team ID required for non-admin users' },
        { status: 400 }
      )
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('Failed to get users:', error)
    return NextResponse.json(
      { error: 'Failed to get users' },
      { status: 500 }
    )
  }
}
