import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  buildTicketReorderPlan,
  canReorderTicket,
  validateTicketReorder,
} from '@/lib/ticket-reorder'
import { isTransactionConflict } from '@/lib/transaction-conflicts'

const REORDER_CONFLICT = 'Ticket order changed; reload before reordering'

class ReorderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let targetTicketId: string
  try {
    const body = await request.json()
    targetTicketId = body?.targetTicketId
  } catch {
    return NextResponse.json({ error: 'A different target ticket is required' }, { status: 400 })
  }
  if (typeof targetTicketId !== 'string' || !targetTicketId || targetTicketId === params.id) {
    return NextResponse.json({ error: 'A different target ticket is required' }, { status: 400 })
  }

  try {
    const positions = await prisma.$transaction(
      async (tx) => {
        const lockedTickets = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "Ticket"
          WHERE "id" IN (${params.id}, ${targetTicketId})
          ORDER BY "id"
          FOR UPDATE
        `
        if (lockedTickets.length !== 2) throw new ReorderError('Ticket not found', 404)

        const tickets = await tx.ticket.findMany({
          where: { id: { in: [params.id, targetTicketId] } },
          include: { team: { select: { id: true, classWorkspaceId: true } } },
        })
        const ticket = tickets.find(({ id }) => id === params.id)
        const target = tickets.find(({ id }) => id === targetTicketId)
        if (!ticket || !target) throw new ReorderError('Ticket not found', 404)

        const validation = validateTicketReorder(ticket, target)
        if (!validation.ok) {
          throw new ReorderError(
            validation.error,
            validation.error.startsWith('Archived') ? 409 : 400
          )
        }

        const teams = await tx.$queryRaw<{ id: string; classWorkspaceId: string | null }[]>`
          SELECT "id", "classWorkspaceId"
          FROM "Team"
          WHERE "id" = ${ticket.teamId}
          FOR UPDATE
        `
        const team = teams[0]
        if (!team) throw new ReorderError('Ticket not found', 404)
        if (team.classWorkspaceId) {
          const workspaces = await tx.$queryRaw<{ archivedAt: Date | null }[]>`
            SELECT "archivedAt"
            FROM "ClassWorkspace"
            WHERE "id" = ${team.classWorkspaceId}
            FOR UPDATE
          `
          if (!workspaces[0]) throw new ReorderError('Ticket not found', 404)
          if (workspaces[0].archivedAt) {
            throw new ReorderError('Archived class boards are read-only', 409)
          }
        }

        await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "TeamMember"
          WHERE "teamId" = ${ticket.teamId} AND "userId" = ${session.user.id}
          FOR UPDATE
        `
        const membership = await tx.teamMember.findUnique({
          where: {
            userId_teamId: { userId: session.user.id, teamId: ticket.teamId },
          },
          select: { role: true },
        })
        if (!canReorderTicket(
          { id: session.user.id, role: session.user.role as any },
          {
            isMember: !!membership,
            isLead: membership?.role === 'LEAD',
            assigneeId: ticket.assigneeId,
            createdById: ticket.createdById,
          }
        )) {
          throw new ReorderError('You do not have permission to reorder this ticket', 403)
        }

        await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "Ticket"
          WHERE "teamId" = ${ticket.teamId}
            AND "status" = CAST(${ticket.status} AS "TicketStatus")
            AND "archived" = false
          ORDER BY "id"
          FOR UPDATE
        `
        const columnTickets = await tx.ticket.findMany({
          where: { teamId: ticket.teamId, status: ticket.status, archived: false },
          select: { id: true, position: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        })
        const plan = buildTicketReorderPlan(columnTickets, ticket.id, target.id)

        for (const update of plan) {
          await tx.ticket.update({ where: { id: update.id }, data: { position: update.position } })
        }
        return plan
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json({ positions })
  } catch (error) {
    if (error instanceof ReorderError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (isTransactionConflict(error)) {
      return NextResponse.json({ error: REORDER_CONFLICT }, { status: 409 })
    }
    console.error('Failed to reorder ticket:', error)
    return NextResponse.json({ error: 'Failed to reorder ticket' }, { status: 500 })
  }
}
