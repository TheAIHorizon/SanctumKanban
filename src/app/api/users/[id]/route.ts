import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET - Get a single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Users can only view their own profile, admins can view any
    if (session.user.role !== 'ADMIN' && session.user.id !== params.id) {
      return NextResponse.json(
        { error: 'You can only view your own profile' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to get user:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}

// PATCH - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    const isSelf = session.user.id === params.id

    // Users can only update their own profile, admins can update any
    if (!isAdmin && !isSelf) {
      return NextResponse.json(
        { error: 'You can only update your own profile' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, contactInfo, color, role, password, email } = body

    // Only admins can change roles
    if (role !== undefined && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can change user roles' },
        { status: 403 }
      )
    }

    // Check if email is being changed and already exists
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: params.id },
        },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (contactInfo !== undefined) updateData.contactInfo = contactInfo
    if (color !== undefined) updateData.color = color
    if (email !== undefined) updateData.email = email
    if (role !== undefined && isAdmin) updateData.role = role
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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
    console.error('Failed to update user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a user (admin only)
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
        { error: 'Only admins can delete users' },
        { status: 403 }
      )
    }

    // Prevent deleting yourself
    if (session.user.id === params.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
