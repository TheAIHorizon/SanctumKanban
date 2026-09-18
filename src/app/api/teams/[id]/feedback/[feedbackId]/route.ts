import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canPinInstructorFeedback, parsePinInput } from '@/lib/instructor-feedback'
import {
  FeedbackRouteError,
  feedbackErrorResponse,
  feedbackPostSelect,
  lockFeedbackTeamContext,
} from '@/lib/instructor-feedback.server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; feedbackId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let input
  try {
    input = parsePinInput(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid pin update' },
      { status: 400 }
    )
  }

  try {
    const post = await prisma.$transaction(
      async (tx) => {
        const context = await lockFeedbackTeamContext(tx, params.id, session.user.id)
        if (!canPinInstructorFeedback(
          { id: session.user.id, role: session.user.role },
          { teamMemberUserIds: context.isMember ? [session.user.id] : [], archived: context.archived }
        )) {
          if (session.user.role !== 'ADMIN') throw new FeedbackRouteError('Forbidden', 403)
          throw new FeedbackRouteError('Archived class boards are read-only', 409)
        }

        const feedback = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "InstructorFeedback"
          WHERE "id" = ${params.feedbackId} AND "teamId" = ${context.teamId}
          FOR UPDATE
        `
        if (!feedback[0]) throw new FeedbackRouteError('Feedback not found', 404)

        return (tx as any).instructorFeedback.update({
          where: { id: feedback[0].id },
          data: { pinned: input.pinned },
          select: feedbackPostSelect,
        })
      },
      { isolationLevel: 'Serializable' }
    )
    return NextResponse.json({ post })
  } catch (error) {
    return feedbackErrorResponse(error, 'Failed to update instructor feedback')
  }
}
