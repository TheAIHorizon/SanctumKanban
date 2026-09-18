import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  canReadInstructorFeedback,
  parseFeedbackPostInput,
  serializeFeedbackList,
} from '@/lib/instructor-feedback'
import {
  FeedbackRouteError,
  feedbackAuthorName,
  feedbackErrorResponse,
  feedbackPostSelect,
  lockFeedbackTeamContext,
} from '@/lib/instructor-feedback.server'

const db = prisma as any

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const team = await db.team.findUnique({
      where: { id: params.id },
      select: { id: true, members: { select: { userId: true } } },
    })
    if (!team || !canReadInstructorFeedback(
      { id: session.user.id, role: session.user.role },
      { teamMemberUserIds: team?.members.map(({ userId }: { userId: string }) => userId) ?? [] }
    )) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [posts, receipt] = await Promise.all([
      db.instructorFeedback.findMany({
        where: { teamId: params.id },
        select: feedbackPostSelect,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      }),
      db.teamFeedbackRead.findUnique({
        where: { teamId_userId: { teamId: params.id, userId: session.user.id } },
        select: { readThrough: true },
      }),
    ])

    return NextResponse.json(serializeFeedbackList(posts, session.user.id, receipt?.readThrough ?? null))
  } catch (error) {
    return feedbackErrorResponse(error, 'Failed to load instructor feedback')
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let input
  try {
    input = parseFeedbackPostInput(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid feedback' },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const context = await lockFeedbackTeamContext(tx, params.id, session.user.id)
        if (session.user.role !== 'ADMIN') throw new FeedbackRouteError('Forbidden', 403)
        if (context.archived) {
          throw new FeedbackRouteError('Archived class boards are read-only', 409)
        }

        if (input.ticketId) {
          const tickets = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "Ticket"
            WHERE "id" = ${input.ticketId}
              AND "teamId" = ${context.teamId}
              AND "archived" = false
            FOR UPDATE
          `
          if (!tickets[0]) {
            throw new FeedbackRouteError('ticketId must reference an active ticket on this team', 400)
          }
        }

        await (tx as any).instructorFeedback.create({
          data: {
            teamId: context.teamId,
            ticketId: input.ticketId,
            authorId: session.user.id,
            authorName: feedbackAuthorName(session.user),
            body: input.body,
            category: input.category,
            pinned: input.pinned,
          },
        })

        const [posts, receipt] = await Promise.all([
          (tx as any).instructorFeedback.findMany({
            where: { teamId: context.teamId },
            select: feedbackPostSelect,
            orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
          }),
          (tx as any).teamFeedbackRead.findUnique({
            where: { teamId_userId: { teamId: context.teamId, userId: session.user.id } },
            select: { readThrough: true },
          }),
        ])
        return serializeFeedbackList(posts, session.user.id, receipt?.readThrough ?? null)
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return feedbackErrorResponse(error, 'Failed to post instructor feedback')
  }
}
