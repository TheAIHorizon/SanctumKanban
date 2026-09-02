import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ensureLegacyClassWorkspace } from '@/lib/class-workspaces.server'

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
    const { name, description, memberIds, leadId, classWorkspaceId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      )
    }

    await ensureLegacyClassWorkspace()
    const workspace = classWorkspaceId
      ? await prisma.classWorkspace.findFirst({ where: { id: classWorkspaceId, archivedAt: null } })
      : await prisma.classWorkspace.findFirst({ where: { archivedAt: null }, orderBy: { createdAt: 'desc' } })
    if (!workspace) {
      return NextResponse.json({ error: 'An active class workspace is required' }, { status: 400 })
    }

    const allMemberIds = Array.from(new Set([...(memberIds || []), ...(leadId ? [leadId] : [])]))
    const team = await prisma.team.create({
      data: {
        name,
        description,
        classWorkspaceId: workspace.id,
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

    if (allMemberIds.length) {
      await prisma.classWorkspaceMember.createMany({
        data: allMemberIds.map((userId) => ({ classWorkspaceId: workspace.id, userId })),
        skipDuplicates: true,
      })
    }

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

    await ensureLegacyClassWorkspace()
    const { searchParams } = new URL(request.url)
    const classWorkspaceId = searchParams.get('classId') || undefined
    const includeArchived = searchParams.get('archived') === 'true'

    const classScope: any = {
      ...(classWorkspaceId ? { id: classWorkspaceId } : {}),
      ...(includeArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
    }
    if (!['ADMIN', 'OBSERVER'].includes(session.user.role)) {
      classScope.members = { some: { userId: session.user.id } }
    }

    const teams = await prisma.team.findMany({
      where: { classWorkspace: classScope },
      include: {
        classWorkspace: { select: { id: true, name: true, archivedAt: true } },
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
        _count: { select: { tickets: true } },
      },
      orderBy: [{ classWorkspace: { name: 'asc' } }, { name: 'asc' }],
    })

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Failed to get teams:', error)
    return NextResponse.json(
      { error: 'Failed to get teams' },
      { status: 500 }
    )
  }
}
