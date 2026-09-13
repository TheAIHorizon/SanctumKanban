import { can, type Principal, type TicketContext } from './permissions'

export interface PositionedTicket {
  id: string
  position: number
}

export interface TicketPositionUpdate {
  id: string
  position: number
}

export interface ReorderTicketIdentity {
  id: string
  teamId: string
  status: string
  archived: boolean
}

export type ReorderValidation = { ok: true } | { ok: false; error: string }

export function canReorderTicket(
  principal: Principal,
  context: TicketContext
): boolean {
  return principal.role === 'ADMIN' || (!!context.isMember && can(principal, 'ticket:update', context))
}

export function validateTicketReorder(
  ticket: ReorderTicketIdentity,
  target: ReorderTicketIdentity
): ReorderValidation {
  if (ticket.archived || target.archived) {
    return { ok: false, error: 'Archived tickets cannot be reordered' }
  }
  if (ticket.teamId !== target.teamId) {
    return { ok: false, error: 'Tickets must belong to the same team' }
  }
  if (ticket.status !== target.status) {
    return { ok: false, error: 'Tickets must belong to the same column' }
  }
  return { ok: true }
}

/**
 * Move a ticket to the target ticket's logical slot and normalize the complete
 * column to unique, contiguous positions. Callers must provide every active
 * ticket in the column; this keeps hidden/filtered tickets in the ordering.
 */
export function buildTicketReorderPlan(
  columnTickets: PositionedTicket[],
  ticketId: string,
  targetTicketId: string
): TicketPositionUpdate[] {
  const ordered = [...columnTickets].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id)
  )
  const fromIndex = ordered.findIndex((ticket) => ticket.id === ticketId)
  const targetIndex = ordered.findIndex((ticket) => ticket.id === targetTicketId)

  if (fromIndex < 0 || targetIndex < 0) {
    throw new Error('Ticket and target must belong to the column')
  }

  const [moved] = ordered.splice(fromIndex, 1)
  ordered.splice(targetIndex, 0, moved)

  return ordered.map((ticket, index) => ({ id: ticket.id, position: index + 1 }))
}

/** Build a filtered-board optimistic update without claiming hidden positions. */
export function buildVisibleTicketPositionUpdates(
  visibleTickets: PositionedTicket[],
  ticketId: string,
  targetTicketId: string
): TicketPositionUpdate[] {
  const ordered = [...visibleTickets].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id)
  )
  const positionSlots = ordered.map((ticket) => ticket.position)
  const fromIndex = ordered.findIndex((ticket) => ticket.id === ticketId)
  const targetIndex = ordered.findIndex((ticket) => ticket.id === targetTicketId)

  if (fromIndex < 0 || targetIndex < 0) {
    throw new Error('Ticket and target must be visible in the column')
  }

  const [moved] = ordered.splice(fromIndex, 1)
  ordered.splice(targetIndex, 0, moved)
  return ordered.map((ticket, index) => ({ id: ticket.id, position: positionSlots[index] }))
}