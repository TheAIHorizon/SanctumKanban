import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canAcknowledgeInstructorFeedback, parseAcknowledgeInput } from '@/lib/instructor-feedback'
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

  try {
    parseAcknowledgeInput(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid acknowledgment' },
      { status: 400 }
    )
  }

  try {
    const acknowledgment = await prisma.$transaction(
      async (tx) => {
        const context = await lockFeedbackTeamContext(tx, params.id, session.user.id)
        if (!canAcknowledgeInstructorFeedback(
          { id: session.user.id, role: session.user.role },
          {
            teamMemberUserIds: context.isMember ? [session.user.id] : [],
            archived: false,
          }
        )) throw new FeedbackRouteError('Forbidden', 403)
        if (context.archived) throw new FeedbackRouteError('Archived class boards are read-only', 409)

        const feedback = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "InstructorFeedback"
          WHERE "id" = ${params.feedbackId} AND "teamId" = ${context.teamId}
          FOR UPDATE
        `
        if (!feedback[0]) throw new FeedbackRouteError('Feedback not found', 404)

        return (tx as any).instructorFeedbackAcknowledgment.upsert({
          where: {
            feedbackId_userId: {
              feedbackId: feedback[0].id,
              userId: session.user.id,
            },
          },
          create: {
            feedbackId: feedback[0].id,
            userId: session.user.id,
            userName: feedbackAuthorName(session.user),
          },
          update: {},
          select: { userId: true, userName: true, createdAt: true },
        })
      },
      { isolationLevel: 'Serializable' }
    )
    return NextResponse.json({ acknowledgment })
  } catch (error) {
    return feedbackErrorResponse(error, 'Failed to acknowledge instructor feedback')
  }
}
