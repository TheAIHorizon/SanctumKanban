import type { TicketPositionUpdate } from './ticket-reorder'

/** Apply authoritative positions to the full board, not just the filtered view. */
export function applyTicketPositions<T extends { id: string; position: number }>(
  tickets: T[],
  positions: TicketPositionUpdate[]
): T[] {
  const byId = new Map(positions.map(({ id, position }) => [id, position]))
  return tickets.map(ticket => byId.has(ticket.id)
    ? { ...ticket, position: byId.get(ticket.id)! }
    : ticket)
}
