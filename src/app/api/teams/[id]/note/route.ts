import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  canReadTeamNote,
  canWriteTeamNote,
  parseExpectedRevision,
  validateTeamNoteContent,
} from '@/lib/team-notes'
import { isTransactionConflict } from '@/lib/transaction-conflicts'

const NOTE_CONFLICT = 'Team note changed; reload before saving'

class TeamNotePutError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function loadTeam(id: string) {
  return prisma.team.findUnique({
    where: { id },
    select: {
      id: true,
      members: { select: { userId: true } },
      classWorkspace: {
        select: {
          archivedAt: true,
          members: { select: { userId: true } },
        },
      },
      note: { select: { id: true, content: true, revision: true, updatedAt: true } },
    },
  })
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const team = await loadTeam(params.id)
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  const teamMemberUserIds = team.members.map(({ userId }) => userId)
  if (!canReadTeamNote(
    { id: session.user.id, role: session.user.role },
    {
      hasClass: !!team.classWorkspace,
      classMemberUserIds: team.classWorkspace?.members.map(({ userId }) => userId) ?? [],
      teamMemberUserIds,
    }
  )) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(team.note ?? { content: '', revision: 0, updatedAt: null })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let content: string
  let expectedRevision: number
  try {
    const body = await request.json()
    content = validateTeamNoteContent(body.content)
    expectedRevision = parseExpectedRevision(body.revision)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid team note' },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const teams = await tx.$queryRaw<{ id: string; classWorkspaceId: string | null }[]>`
          SELECT "id", "classWorkspaceId"
          FROM "Team"
          WHERE "id" = ${params.id}
          FOR UPDATE
        `
        const team = teams[0]
        if (!team) throw new TeamNotePutError('Team not found', 404)

        let archived = false
        if (team.classWorkspaceId) {
          const workspaces = await tx.$queryRaw<{ archivedAt: Date | null }[]>`
            SELECT "archivedAt"
            FROM "ClassWorkspace"
            WHERE "id" = ${team.classWorkspaceId}
            FOR UPDATE
          `
          if (!workspaces[0]) throw new TeamNotePutError('Team not found', 404)
          archived = workspaces[0].archivedAt != null
        }

        if (session.user.role !== 'ADMIN') {
          await tx.$queryRaw<{ id: string }[]>`
            SELECT "id"
            FROM "TeamMember"
            WHERE "teamId" = ${team.id} AND "userId" = ${session.user.id}
            FOR UPDATE
          `
        }
        const membership = await tx.teamMember.findUnique({
          where: { userId_teamId: { userId: session.user.id, teamId: team.id } },
          select: { userId: true },
        })
        if (!canWriteTeamNote(
          { id: session.user.id, role: session.user.role },
          { teamMemberUserIds: membership ? [membership.userId] : [], archived }
        )) {
          throw new TeamNotePutError(
            archived ? 'Archived class boards are read-only' : 'Forbidden',
            archived ? 409 : 403
          )
        }

        const note = await tx.teamNote.findUnique({
          where: { teamId: team.id },
          select: { id: true, revision: true },
        })
        if (!note) {
          if (expectedRevision !== 0) throw new TeamNotePutError(NOTE_CONFLICT, 409)
          return tx.teamNote.create({
            data: { teamId: team.id, content, revision: 1 },
            select: { id: true, content: true, revision: true, updatedAt: true },
          })
        }

        const result = await tx.teamNote.updateMany({
          where: { teamId: team.id, revision: expectedRevision },
          data: { content, revision: { increment: 1 } },
        })
        if (result.count !== 1) throw new TeamNotePutError(NOTE_CONFLICT, 409)

        return tx.teamNote.findUnique({
          where: { teamId: team.id },
          select: { id: true, content: true, revision: true, updatedAt: true },
        })
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof TeamNotePutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (
      isTransactionConflict(error) ||
      (!!error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
    ) {
      return NextResponse.json({ error: NOTE_CONFLICT }, { status: 409 })
    }
    console.error('Failed to update team note:', error)
    return NextResponse.json({ error: 'Failed to update team note' }, { status: 500 })
  }
}
