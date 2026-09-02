import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/classes/[id] — class metadata + teams (active or archived).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.classWorkspace.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      teams: { include: { _count: { select: { tickets: true, members: true } } }, orderBy: { name: 'asc' } },
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const allowed =
    session.user.role === 'ADMIN' ||
    workspace.members.some((member) => member.userId === session.user.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(workspace)
}

// PATCH /api/classes/[id] — rename/update or archive/restore (admin only).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await prisma.classWorkspace.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const body = await request.json()
  const action = body.action as 'archive' | 'restore' | undefined
  const updated = await prisma.classWorkspace.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.code !== undefined && { code: body.code?.trim() || null }),
      ...(body.term !== undefined && { term: body.term?.trim() || null }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(action === 'archive' && { archivedAt: new Date() }),
      ...(action === 'restore' && { archivedAt: null }),
    },
    include: { _count: { select: { teams: true } } },
  })

  return NextResponse.json(updated)
}
