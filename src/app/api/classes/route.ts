import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { loadClassWorkspaceSummaries } from '@/lib/class-workspaces.server'
import { visibleClassWorkspaces } from '@/lib/class-workspaces'

// GET /api/classes?archived=true — classes visible to the caller.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const archived = new URL(request.url).searchParams.get('archived') === 'true'
  const all = await loadClassWorkspaceSummaries()
  const visible = visibleClassWorkspaces(
    all.map((workspace) => ({
      ...workspace,
      memberUserIds: workspace.members.map((member) => member.userId),
    })),
    { id: session.user.id, role: session.user.role },
    archived
  )
  return NextResponse.json(visible)
}

// POST /api/classes — create an empty class, optionally copying team names.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, code, term, description, copyTeamStructureFromId } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Class name is required' }, { status: 400 })

  const source = copyTeamStructureFromId
    ? await prisma.classWorkspace.findUnique({
        where: { id: copyTeamStructureFromId },
        select: { teams: { select: { name: true, description: true }, orderBy: { name: 'asc' } } },
      })
    : null

  const workspace = await prisma.classWorkspace.create({
    data: {
      name: name.trim(),
      code: code?.trim() || null,
      term: term?.trim() || null,
      description: description?.trim() || null,
      createdById: session.user.id,
      members: { create: { userId: session.user.id } },
      teams: source?.teams.length
        ? { create: source.teams.map((team) => ({ name: team.name, description: team.description })) }
        : undefined,
    },
    include: { _count: { select: { teams: true } } },
  })

  return NextResponse.json(workspace, { status: 201 })
}
