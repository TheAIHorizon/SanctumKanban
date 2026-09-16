export const TICKET_STATUSES = ['BACKLOG', 'DOING', 'DONE'] as const

export type TicketStatusValue = (typeof TICKET_STATUSES)[number]

export function isTicketStatus(value: unknown): value is TicketStatusValue {
  return typeof value === 'string' && TICKET_STATUSES.includes(value as TicketStatusValue)
}

export function completionForNewTicket(status: TicketStatusValue, now: Date): Date | null {
  return status === 'DONE' ? now : null
}

export type CompletionTransitionPlan = {
  shouldWrite: boolean
  completedAt: Date | null
  historyDetails: { completedAt: string } | { previousCompletedAt: string | null } | undefined
}

export function planCompletionTransition(
  currentStatus: TicketStatusValue,
  currentCompletedAt: Date | null,
  requestedStatus: TicketStatusValue | undefined,
  now: Date,
): CompletionTransitionPlan {
  if (requestedStatus === 'DONE' && currentStatus !== 'DONE') {
    return {
      shouldWrite: true,
      completedAt: now,
      historyDetails: { completedAt: now.toISOString() },
    }
  }

  if (currentStatus === 'DONE' && requestedStatus !== undefined && requestedStatus !== 'DONE') {
    return {
      shouldWrite: true,
      completedAt: null,
      historyDetails: {
        previousCompletedAt: currentCompletedAt?.toISOString() ?? null,
      },
    }
  }

  return {
    shouldWrite: false,
    completedAt: currentCompletedAt,
    historyDetails: undefined,
  }
}
