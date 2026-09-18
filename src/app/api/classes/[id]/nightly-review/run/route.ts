import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Queues work for the separate runner; HTTP requests never start background inference.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const workspace = await prisma.classWorkspace.findUnique({
    where: { id: params.id },
    select: { id: true, archivedAt: true, nightlyReviewEnabled: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  if (workspace.archivedAt) return NextResponse.json({ error: 'Archived classes are read-only' }, { status: 409 })
  if (!workspace.nightlyReviewEnabled) {
    return NextResponse.json({ error: 'Nightly review is not enabled for this class' }, { status: 409 })
  }

  const requestedAt = new Date()
  const queued = await prisma.classWorkspace.updateMany({
    where: { id: params.id, archivedAt: null, nightlyReviewEnabled: true },
    data: { nightlyReviewRequestedAt: requestedAt },
  })
  if (queued.count !== 1) return NextResponse.json({ error: 'Class is no longer available for review' }, { status: 409 })
  return NextResponse.json({ requestedAt }, { status: 202 })
}
