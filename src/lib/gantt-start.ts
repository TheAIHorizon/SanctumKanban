import {
  dateKey,
  differenceInCalendarDays,
  toCalendarDate,
  type GanttDateInput,
  type GanttDateRange,
} from './gantt'

export interface GanttStartTicket {
  startDate?: GanttDateInput | null
  startedAt?: GanttDateInput | null
  startDateAutoFilled?: boolean
}

export type GanttStartKind = 'early' | 'on-plan' | 'late' | 'automatic' | 'not-started'

export interface GanttStart {
  kind: GanttStartKind
  actualDate: string | null
  comparisonDays: number | null
  label: string | null
}

function varianceLabel(days: number): string {
  const magnitude = Math.abs(days)
  return `Started ${magnitude} ${magnitude === 1 ? 'day' : 'days'} ${days < 0 ? 'early' : 'late'}`
}

/** Compare only server-recorded starts against genuine (non-automatic) plans. */
export function getGanttStart(ticket: GanttStartTicket): GanttStart {
  const actualDate = ticket.startedAt ? dateKey(ticket.startedAt) : null
  if (!actualDate) return { kind: 'not-started', actualDate: null, comparisonDays: null, label: null }

  const plannedDate = ticket.startDate ? dateKey(ticket.startDate) : null
  if (!plannedDate || ticket.startDateAutoFilled) {
    return {
      kind: 'automatic', actualDate, comparisonDays: null,
      label: 'Started · no original plan',
    }
  }

  const comparisonDays = differenceInCalendarDays(actualDate, plannedDate)
  if (comparisonDays === 0) {
    return { kind: 'on-plan', actualDate, comparisonDays, label: 'Started on plan' }
  }
  return {
    kind: comparisonDays < 0 ? 'early' : 'late',
    actualDate,
    comparisonDays,
    label: varianceLabel(comparisonDays),
  }
}

export interface GanttStartLayout {
  start: GanttStart
  marker: { date: string; leftPercent: number } | null
  tail: {
    kind: 'early' | 'late'
    leftPercent: number
    widthPercent: number
    clippedStart: boolean
    clippedEnd: boolean
  } | null
}

function center(value: GanttDateInput, range: GanttDateRange): number {
  const days = differenceInCalendarDays(range.end, range.start) + 1
  return (differenceInCalendarDays(value, range.start) + 0.5) / days * 100
}

function inside(value: GanttDateInput, range: GanttDateRange): boolean {
  const time = toCalendarDate(value).getTime()
  return time >= toCalendarDate(range.start).getTime() && time <= toCalendarDate(range.end).getTime()
}

export function layoutGanttStart(ticket: GanttStartTicket, range: GanttDateRange): GanttStartLayout {
  const start = getGanttStart(ticket)
  const marker = start.actualDate && inside(start.actualDate, range)
    ? { date: start.actualDate, leftPercent: center(start.actualDate, range) }
    : null
  const plannedDate = ticket.startDate ? dateKey(ticket.startDate) : null
  let tail: GanttStartLayout['tail'] = null

  if (plannedDate && start.actualDate && (start.kind === 'early' || start.kind === 'late')) {
    const first = start.kind === 'early' ? start.actualDate : plannedDate
    const last = start.kind === 'early' ? plannedDate : start.actualDate
    const rawStart = center(first, range)
    const rawEnd = center(last, range)
    const visibleStart = Math.max(0, rawStart)
    const visibleEnd = Math.min(100, rawEnd)
    if (visibleStart <= visibleEnd && rawEnd >= 0 && rawStart <= 100) {
      tail = {
        kind: start.kind,
        leftPercent: visibleStart,
        widthPercent: visibleEnd - visibleStart,
        clippedStart: rawStart < 0,
        clippedEnd: rawEnd > 100,
      }
    }
  }

  return { start, marker, tail }
}
