import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  authorizeUserFieldUpdate,
  authorizeUserTargetUpdate,
} from '@/lib/user-profile-security'

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

    const targetAuthorization = authorizeUserTargetUpdate(session.user, params.id)
    if (!targetAuthorization.allowed) {
      return NextResponse.json(
        { error: targetAuthorization.error },
        { status: targetAuthorization.status }
      )
    }

    const body = await request.json()
    const { firstName, lastName, contactInfo, color, role, password, email, currentPassword } = body
    const fieldAuthorization = authorizeUserFieldUpdate(session.user, body)

    if (!fieldAuthorization.allowed) {
      return NextResponse.json(
        { error: fieldAuthorization.error },
        { status: fieldAuthorization.status }
      )
    }

    const isAdmin = session.user.role === 'ADMIN'

    if (password !== undefined && (typeof password !== 'string' || !password)) {
      return NextResponse.json({ error: 'Password must not be empty' }, { status: 400 })
    }

    if (fieldAuthorization.verifyCurrentPassword) {
      const currentUser = await prisma.user.findUnique({
        where: { id: params.id },
        select: { passwordHash: true },
      })
      if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const validCurrentPassword = await bcrypt.compare(currentPassword, currentUser.passwordHash)
      if (!validCurrentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
      }
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
    if (password !== undefined) updateData.passwordHash = await bcrypt.hash(password, 12)

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
