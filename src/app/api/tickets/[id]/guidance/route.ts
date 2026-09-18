import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import {
  NIGHTLY_PROMPT_VERSION,
  NIGHTLY_REVIEW_MODEL,
  computeNightlyInputHash,
} from '@/lib/nightly-review'
import prisma from '@/lib/prisma'

const configuredModel = process.env.AI_COACH_MODEL || NIGHTLY_REVIEW_MODEL

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'OBSERVER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Archived tickets remain readable here; only team membership and admin status matter.
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      team: {
        select: {
          members: { where: { userId: session.user.id }, select: { id: true } },
        },
      },
      aiGuidanceReviews: {
        orderBy: { createdAt: 'desc' },
        take: 11,
        select: {
          id: true,
          inputHash: true,
          createdAt: true,
          updatedAt: true,
          mode: true,
          model: true,
          guidance: true,
          tasks: true,
          candidateCount: true,
        },
      },
    },
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  const isAdmin = session.user.role === 'ADMIN'
  const isCurrentTeamMember = ticket.team.members.length > 0
  if (!isAdmin && !isCurrentTeamMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const currentHash = computeNightlyInputHash({
    title: ticket.title,
    description: ticket.description,
    model: configuredModel,
    promptVersion: NIGHTLY_PROMPT_VERSION,
  })
  const hasMore = ticket.aiGuidanceReviews.length > 10
  const reviews = ticket.aiGuidanceReviews.slice(0, 10).map(({ inputHash, ...review }) => ({
    ...review,
    isCurrent: inputHash === currentHash,
  }))
  return NextResponse.json({ reviews, hasMore })
}
