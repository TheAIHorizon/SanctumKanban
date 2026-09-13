import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseDeliverablesInput, type DeliverableInput } from '@/lib/deliverables'
import {
  DeliverableDistributionError,
  distributeDeliverablesInTransaction,
} from '@/lib/deliverables.server'

// POST /api/classes/[id]/deliverables — append shared work to every team in an active class.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let deliverables: DeliverableInput[]
  try {
    deliverables = parseDeliverablesInput(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid deliverables' },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.$transaction(
      (tx) => distributeDeliverablesInTransaction(
        tx,
        params.id,
        session.user.id,
        deliverables
      ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DeliverableDistributionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to distribute class deliverables:', error)
    return NextResponse.json({ error: 'Failed to distribute deliverables' }, { status: 500 })
  }
}
