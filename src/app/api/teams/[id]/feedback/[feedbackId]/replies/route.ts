import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canReplyToInstructorFeedback, parseFeedbackReplyInput } from '@/lib/instructor-feedback'
import {
  FeedbackRouteError,
  feedbackAuthorName,
  feedbackErrorResponse,
  lockFeedbackTeamContext,
} from '@/lib/instructor-feedback.server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; feedbackId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let input
  try {
    input = parseFeedbackReplyInput(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid feedback reply' },
      { status: 400 }
    )
  }

  try {
    const reply = await prisma.$transaction(
      async (tx) => {
        const context = await lockFeedbackTeamContext(tx, params.id, session.user.id)
        const permissionContext = {
          teamMemberUserIds: context.isMember ? [session.user.id] : [],
          archived: context.archived,
        }
        if (!canReplyToInstructorFeedback(
          { id: session.user.id, role: session.user.role },
          { ...permissionContext, archived: false }
        )) throw new FeedbackRouteError('Forbidden', 403)
        if (context.archived) throw new FeedbackRouteError('Archived class boards are read-only', 409)

        const feedback = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "InstructorFeedback"
          WHERE "id" = ${params.feedbackId} AND "teamId" = ${context.teamId}
          FOR UPDATE
        `
        if (!feedback[0]) throw new FeedbackRouteError('Feedback not found', 404)

        return (tx as any).instructorFeedbackReply.create({
          data: {
            feedbackId: feedback[0].id,
            authorId: session.user.id,
            authorName: feedbackAuthorName(session.user),
            body: input.body,
          },
          select: { id: true, body: true, authorName: true, createdAt: true },
        })
      },
      { isolationLevel: 'Serializable' }
    )
    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    return feedbackErrorResponse(error, 'Failed to post feedback reply')
  }
}
