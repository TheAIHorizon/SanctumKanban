import type { TicketStatusValue } from './ticket-completion'

export interface TicketStartHistoryDetails {
  startedAt: string
  startDateAutoFilled: boolean
  autoFilledStartDate?: string
}

export interface NewTicketStartPlan {
  startedAt: Date | null
  startDate: Date | null
  startDateAutoFilled: boolean
  historyDetails: TicketStartHistoryDetails | undefined
}

function utcCalendarDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  return left === right || (left !== null && right !== null && left.getTime() === right.getTime())
}

function historyDetails(startedAt: Date, autoFilled: boolean, startDate: Date): TicketStartHistoryDetails {
  return {
    startedAt: startedAt.toISOString(),
    startDateAutoFilled: autoFilled,
    ...(autoFilled && { autoFilledStartDate: startDate.toISOString().slice(0, 10) }),
  }
}

export function planStartForNewTicket(
  status: TicketStatusValue,
  plannedStartDate: Date | null,
  now: Date,
): NewTicketStartPlan {
  if (status !== 'DOING') {
    return {
      startedAt: null,
      startDate: plannedStartDate,
      startDateAutoFilled: false,
      historyDetails: undefined,
    }
  }

  const autoFilled = plannedStartDate === null
  const startDate = plannedStartDate ?? utcCalendarDay(now)
  return {
    startedAt: now,
    startDate,
    startDateAutoFilled: autoFilled,
    historyDetails: historyDetails(now, autoFilled, startDate),
  }
}

export interface StartTransitionInput {
  currentStatus: TicketStatusValue
  currentStartedAt: Date | null
  currentStartDate: Date | null
  currentStartDateAutoFilled: boolean
  requestedStatus: TicketStatusValue | undefined
  nextStartDate: Date | null
  startDateWasProvided: boolean
  now: Date
}

export interface StartTransitionPlan {
  shouldWriteStartedAt: boolean
  startedAt: Date | null
  startDate: Date | null
  startDateAutoFilled: boolean
  shouldWriteSchedule: boolean
  historyDetails: TicketStartHistoryDetails | undefined
}

export function planStartTransition(input: StartTransitionInput): StartTransitionPlan {
  const firstActualStart = input.requestedStatus === 'DOING' &&
    input.currentStatus !== 'DOING' &&
    input.currentStartedAt === null

  let startDate = input.nextStartDate
  let startDateAutoFilled = input.currentStartDateAutoFilled

  if (input.startDateWasProvided && !sameInstant(input.nextStartDate, input.currentStartDate)) {
    startDateAutoFilled = false
  }

  if (firstActualStart && startDate === null) {
    startDate = utcCalendarDay(input.now)
    startDateAutoFilled = true
  }

  const startedAt = firstActualStart ? input.now : input.currentStartedAt
  return {
    shouldWriteStartedAt: firstActualStart,
    startedAt,
    startDate,
    startDateAutoFilled,
    shouldWriteSchedule:
      !sameInstant(startDate, input.currentStartDate) ||
      startDateAutoFilled !== input.currentStartDateAutoFilled,
    historyDetails: firstActualStart
      ? historyDetails(input.now, startDateAutoFilled, startDate!)
      : undefined,
  }
}
