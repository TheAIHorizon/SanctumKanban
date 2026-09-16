import {
  dateKey,
  differenceInCalendarDays,
  toCalendarDate,
  type GanttDateInput,
  type GanttDateRange,
} from './gantt'

export interface GanttCompletionTicket {
  status: string
  dueDate?: GanttDateInput | null
  completedAt?: GanttDateInput | null
}

export type GanttCompletionKind =
  | 'early'
  | 'on-time'
  | 'late'
  | 'completed'
  | 'overdue'
  | 'legacy'
  | 'incomplete'

export interface GanttCompletion {
  kind: GanttCompletionKind
  actualDate: string | null
  comparisonDays: number | null
  label: string | null
}

export interface GanttCompletionMarkerLayout {
  date: string
  leftPercent: number
}

export interface GanttCompletionTailLayout {
  kind: 'early' | 'late' | 'overdue'
  leftPercent: number
  widthPercent: number
  clippedStart: boolean
  clippedEnd: boolean
}

export interface GanttCompletionLayout {
  completion: GanttCompletion
  marker: GanttCompletionMarkerLayout | null
  tail: GanttCompletionTailLayout | null
}

function daysLabel(days: number, suffix: 'early' | 'late'): string {
  return `${days} ${days === 1 ? 'day' : 'days'} ${suffix}`
}

/**
 * Classify completion using UTC calendar dates, matching the rest of the Gantt
 * timeline. Time-of-day and DST never contribute fractional days.
 */
export function getGanttCompletion(
  ticket: GanttCompletionTicket,
  today: GanttDateInput
): GanttCompletion {
  const actualDate = ticket.completedAt ? dateKey(ticket.completedAt) : null
  const dueDate = ticket.dueDate ? dateKey(ticket.dueDate) : null

  if (actualDate) {
    if (!dueDate) {
      return { kind: 'completed', actualDate, comparisonDays: null, label: 'Completed' }
    }

    const comparisonDays = differenceInCalendarDays(actualDate, dueDate)
    if (comparisonDays < 0) {
      return { kind: 'early', actualDate, comparisonDays, label: daysLabel(-comparisonDays, 'early') }
    }
    if (comparisonDays > 0) {
      return { kind: 'late', actualDate, comparisonDays, label: daysLabel(comparisonDays, 'late') }
    }
    return { kind: 'on-time', actualDate, comparisonDays: 0, label: 'Completed on time' }
  }

  if (ticket.status === 'DONE') {
    return { kind: 'legacy', actualDate: null, comparisonDays: null, label: 'Completion date not recorded' }
  }

  if (dueDate && differenceInCalendarDays(today, dueDate) > 0) {
    return {
      kind: 'overdue',
      actualDate: null,
      comparisonDays: differenceInCalendarDays(today, dueDate),
      label: 'Overdue—not completed',
    }
  }

  return { kind: 'incomplete', actualDate: null, comparisonDays: null, label: null }
}

function calendarDayCenterPercent(value: GanttDateInput, range: GanttDateRange): number {
  const dayCount = differenceInCalendarDays(range.end, range.start) + 1
  return (differenceInCalendarDays(value, range.start) + 0.5) / dayCount * 100
}

function isInsideRange(value: GanttDateInput, range: GanttDateRange): boolean {
  const date = toCalendarDate(value).getTime()
  return date >= toCalendarDate(range.start).getTime() && date <= toCalendarDate(range.end).getTime()
}

/** Layout the actual marker and variance/overdue tail, clipped to the window. */
export function layoutGanttCompletion(
  ticket: GanttCompletionTicket,
  today: GanttDateInput,
  range: GanttDateRange
): GanttCompletionLayout {
  const completion = getGanttCompletion(ticket, today)
  const marker = completion.actualDate && isInsideRange(completion.actualDate, range)
    ? { date: completion.actualDate, leftPercent: calendarDayCenterPercent(completion.actualDate, range) }
    : null

  const dueDate = ticket.dueDate ? dateKey(ticket.dueDate) : null
  let tailStart: string | null = null
  let tailEnd: string | null = null
  let tailKind: GanttCompletionTailLayout['kind'] | null = null

  if (dueDate && completion.actualDate && (completion.kind === 'early' || completion.kind === 'late')) {
    tailStart = completion.kind === 'early' ? completion.actualDate : dueDate
    tailEnd = completion.kind === 'early' ? dueDate : completion.actualDate
    tailKind = completion.kind
  } else if (dueDate && completion.kind === 'overdue') {
    tailStart = dueDate
    tailEnd = dateKey(today)
    tailKind = 'overdue'
  }

  let tail: GanttCompletionTailLayout | null = null
  if (tailStart && tailEnd && tailKind) {
    const rawStart = calendarDayCenterPercent(tailStart, range)
    const rawEnd = calendarDayCenterPercent(tailEnd, range)
    const visibleStart = Math.max(0, rawStart)
    const visibleEnd = Math.min(100, rawEnd)
    if (visibleStart <= visibleEnd && rawEnd >= 0 && rawStart <= 100) {
      tail = {
        kind: tailKind,
        leftPercent: visibleStart,
        widthPercent: visibleEnd - visibleStart,
        clippedStart: rawStart < 0,
        clippedEnd: rawEnd > 100,
      }
    }
  }

  return { completion, marker, tail }
}
