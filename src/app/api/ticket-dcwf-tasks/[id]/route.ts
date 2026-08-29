import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkTicketPermission } from '@/lib/ticket-permissions'

// PATCH /api/ticket-dcwf-tasks/[id]  { note }
// Edit the reflection note on a ticket<->DCWF-task link.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const link = await prisma.ticketDcwfTask.findUnique({
      where: { id: params.id },
      select: { id: true, ticketId: true },
    })
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    const perm = await checkTicketPermission(link.ticketId, session.user.id, session.user.role)
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status })
    }

    const body = await request.json()
    const { note } = body as { note?: string }

    const updated = await prisma.ticketDcwfTask.update({
      where: { id: params.id },
      data: { note: note ?? null },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update DCWF task note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

// DELETE /api/ticket-dcwf-tasks/[id]
// Remove a ticket<->DCWF-task link.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const link = await prisma.ticketDcwfTask.findUnique({
      where: { id: params.id },
      select: { id: true, ticketId: true },
    })
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    const perm = await checkTicketPermission(link.ticketId, session.user.id, session.user.role)
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status })
    }

    await prisma.ticketDcwfTask.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete DCWF task link:', error)
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 })
  }
}
