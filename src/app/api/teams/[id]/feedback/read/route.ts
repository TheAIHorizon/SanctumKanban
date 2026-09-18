import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canReadInstructorFeedback, parseFeedbackReadInput } from '@/lib/instructor-feedback'
import {
  FeedbackRouteError,
  feedbackErrorResponse,
  lockFeedbackTeamContext,
} from '@/lib/instructor-feedback.server'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let input
  try {
    input = parseFeedbackReadInput(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid read receipt' },
      { status: 400 }
    )
  }

  try {
    const receipt = await prisma.$transaction(
      async (tx) => {
        const context = await lockFeedbackTeamContext(tx, params.id, session.user.id)
        if (!canReadInstructorFeedback(
          { id: session.user.id, role: session.user.role },
          { teamMemberUserIds: context.isMember ? [session.user.id] : [] }
        )) throw new FeedbackRouteError('Forbidden', 403)
        if (context.archived) throw new FeedbackRouteError('Archived class boards are read-only', 409)

        const throughRows = await tx.$queryRaw<Array<{ id: string; createdAt: Date }>>`
          SELECT "id", "createdAt"
          FROM "InstructorFeedback"
          WHERE "id" = ${input.throughId} AND "teamId" = ${params.id}
          FOR UPDATE
        `
        const through = throughRows[0]
        if (!through) throw new FeedbackRouteError('throughId must reference feedback on this team', 400)

        const existing = await (tx as any).teamFeedbackRead.findUnique({
          where: { teamId_userId: { teamId: params.id, userId: session.user.id } },
          select: { id: true, readThrough: true },
        })
        if (existing && !(through.createdAt > existing.readThrough)) return existing

        return (tx as any).teamFeedbackRead.upsert({
          where: { teamId_userId: { teamId: params.id, userId: session.user.id } },
          create: {
            teamId: params.id,
            userId: session.user.id,
            readThrough: through.createdAt,
          },
          update: { readThrough: through.createdAt },
          select: { id: true, readThrough: true },
        })
      },
      { isolationLevel: 'Serializable' }
    )
    return NextResponse.json({ readThrough: receipt.readThrough })
  } catch (error) {
    return feedbackErrorResponse(error, 'Failed to mark instructor feedback read')
  }
}
