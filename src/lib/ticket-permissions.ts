import { prisma } from '@/lib/prisma'

export interface TicketPermission {
  ok: boolean
  status?: number
  error?: string
  ticket?: { id: string; assigneeId: string | null; teamId: string }
}

/**
 * Shared ticket-permission check, mirroring the rule in
 * /api/tickets/[id]/route.ts: ADMIN, the team LEAD, or the ticket's assignee
 * may modify a ticket (and, here, its DCWF task links).
 */
export async function checkTicketPermission(
  ticketId: string,
  userId: string,
  userRole: string
): Promise<TicketPermission> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { team: { include: { members: true } } },
  })

  if (!ticket) {
    return { ok: false, status: 404, error: 'Ticket not found' }
  }

  const isAdmin = userRole === 'ADMIN'
  const membership = ticket.team.members.find((m) => m.userId === userId)
  const isTeamLead = membership?.role === 'LEAD'
  const isAssignee = ticket.assigneeId === userId

  if (!isAdmin && !isTeamLead && !isAssignee) {
    return { ok: false, status: 403, error: 'You do not have permission to modify this ticket' }
  }

  return {
    ok: true,
    ticket: { id: ticket.id, assigneeId: ticket.assigneeId, teamId: ticket.teamId },
  }
}
