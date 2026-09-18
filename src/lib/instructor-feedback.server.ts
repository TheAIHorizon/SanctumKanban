import { NextResponse } from 'next/server'
import { isTransactionConflict } from './transaction-conflicts'

export class FeedbackRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export type LockedFeedbackTeamContext = {
  teamId: string
  classWorkspaceId: string | null
  archived: boolean
  isMember: boolean
}

export async function lockFeedbackTeamContext(
  tx: any,
  teamId: string,
  userId: string
): Promise<LockedFeedbackTeamContext> {
  const teams = await tx.$queryRaw<Array<{ id: string; classWorkspaceId: string | null }>>`
    SELECT "id", "classWorkspaceId"
    FROM "Team"
    WHERE "id" = ${teamId}
    FOR UPDATE
  `
  const team = teams[0]
  if (!team) throw new FeedbackRouteError('Forbidden', 403)

  let archived = false
  if (team.classWorkspaceId) {
    const classes = await tx.$queryRaw<Array<{ archivedAt: Date | null }>>`
      SELECT "archivedAt"
      FROM "ClassWorkspace"
      WHERE "id" = ${team.classWorkspaceId}
      FOR UPDATE
    `
    if (!classes[0]) throw new FeedbackRouteError('Forbidden', 403)
    archived = classes[0].archivedAt !== null
  }

  const memberships = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "TeamMember"
    WHERE "teamId" = ${team.id} AND "userId" = ${userId}
    FOR UPDATE
  `

  return {
    teamId: team.id,
    classWorkspaceId: team.classWorkspaceId,
    archived,
    isMember: memberships.length > 0,
  }
}

export function feedbackAuthorName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim()
}

export function feedbackErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof FeedbackRouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (isTransactionConflict(error)) {
    return NextResponse.json(
      { error: 'Feedback changed concurrently; reload and try again' },
      { status: 409 }
    )
  }
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export const feedbackPostSelect = {
  id: true,
  body: true,
  category: true,
  pinned: true,
  createdAt: true,
  authorName: true,
  ticket: { select: { id: true, title: true } },
  replies: {
    select: { id: true, body: true, authorName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  acknowledgments: {
    select: { userId: true, userName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
  },
} as const
