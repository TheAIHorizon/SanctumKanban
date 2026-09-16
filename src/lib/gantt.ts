import { can, type Role } from './permissions'

export type GanttScale = 'week' | 'month'
export type GanttDateInput = Date | string

export interface GanttDateRange {
  start: GanttDateInput
  end: GanttDateInput
}

export interface GanttWindow {
  start: Date
  end: Date
  dayCount: number
}

export interface GanttBarLayout {
  leftPercent: number
  widthPercent: number
  clippedStart: boolean
  clippedEnd: boolean
}

export interface GanttPermissionUser {
  id: string
  role: string
}

export interface GanttPermissionTicket {
  createdById?: string | null
  assignee?: { id: string } | null
}

export interface GanttPermissionTeam {
  members: Array<{ userId: string; role: string }>
}

export interface GanttDatedTicket {
  id: string
  startDate?: Date | string | null
  dueDate?: Date | string | null
}

export type UnscheduledReason = 'Missing start date' | 'Missing due date' | 'Missing start and due dates'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const ZONED_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const DAY_MS = 86_400_000

function validCalendarParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function parseCalendarDate(value: GanttDateInput): Date | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }

  const dateOnly = DATE_ONLY.exec(value)
  if (dateOnly) {
    const [, yearValue, monthValue, dayValue] = dateOnly
    const [year, month, day] = [Number(yearValue), Number(monthValue), Number(dayValue)]
    return validCalendarParts(year, month, day) ? new Date(Date.UTC(year, month - 1, day)) : null
  }

  const zoned = ZONED_ISO.exec(value)
  if (!zoned) return null
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] = zoned
  if (
    !validCalendarParts(Number(yearValue), Number(monthValue), Number(dayValue)) ||
    Number(hourValue) > 23 ||
    Number(minuteValue) > 59 ||
    Number(secondValue) > 59
  ) return null

  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return null
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()))
}

/** Parse a calendar date at UTC midnight so DST cannot change day widths. */
export function toCalendarDate(value: GanttDateInput): Date {
  const date = parseCalendarDate(value)
  if (!date) throw new RangeError(`Invalid calendar date: ${value}`)
  return date
}

export function dateKey(value: GanttDateInput): string | null {
  return parseCalendarDate(value)?.toISOString().slice(0, 10) ?? null
}

export function addCalendarDays(value: GanttDateInput, days: number): Date {
  const date = toCalendarDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

export function differenceInCalendarDays(later: GanttDateInput, earlier: GanttDateInput): number {
  return Math.round((toCalendarDate(later).getTime() - toCalendarDate(earlier).getTime()) / DAY_MS)
}

export function getGanttWindow(anchor: GanttDateInput, scale: GanttScale): GanttWindow {
  const date = toCalendarDate(anchor)
  let start: Date
  let end: Date

  if (scale === 'week') {
    const mondayOffset = (date.getUTCDay() + 6) % 7
    start = addCalendarDays(date, -mondayOffset)
    end = addCalendarDays(start, 6)
  } else {
    start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  }

  return { start, end, dayCount: differenceInCalendarDays(end, start) + 1 }
}

export function reconcileGanttAnchorForToday(
  anchor: GanttDateInput,
  previousToday: GanttDateInput,
  nextToday: GanttDateInput
): Date {
  const anchorKey = dateKey(anchor)
  return anchorKey !== null && anchorKey === dateKey(previousToday)
    ? toCalendarDate(nextToday)
    : toCalendarDate(anchor)
}

export function shiftGanttAnchor(anchor: GanttDateInput, scale: GanttScale, amount: number): Date {
  const date = toCalendarDate(anchor)
  if (scale === 'week') return addCalendarDays(date, amount * 7)

  const desiredDay = date.getUTCDate()
  const targetMonthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
  const lastDay = new Date(Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0)).getUTCDate()
  targetMonthStart.setUTCDate(Math.min(desiredDay, lastDay))
  return targetMonthStart
}

export function layoutGanttBar(
  startValue: GanttDateInput,
  dueValue: GanttDateInput,
  range: GanttDateRange
): GanttBarLayout | null {
  const start = toCalendarDate(startValue)
  const due = toCalendarDate(dueValue)
  const rangeStart = toCalendarDate(range.start)
  const rangeEnd = toCalendarDate(range.end)

  if (due < start || due < rangeStart || start > rangeEnd) return null

  const visibleStart = start < rangeStart ? rangeStart : start
  const visibleEnd = due > rangeEnd ? rangeEnd : due
  const dayCount = differenceInCalendarDays(rangeEnd, rangeStart) + 1

  return {
    leftPercent: differenceInCalendarDays(visibleStart, rangeStart) / dayCount * 100,
    widthPercent: (differenceInCalendarDays(visibleEnd, visibleStart) + 1) / dayCount * 100,
    clippedStart: start < rangeStart,
    clippedEnd: due > rangeEnd,
  }
}

export function classifyGanttTickets<T extends GanttDatedTicket>(tickets: readonly T[], range: GanttDateRange) {
  const scheduled: Array<{ ticket: T; layout: GanttBarLayout }> = []
  const unscheduled: Array<{ ticket: T; reason: UnscheduledReason }> = []
  const outOfWindow: T[] = []

  for (const item of tickets) {
    if (!item.startDate || !item.dueDate) {
      const reason: UnscheduledReason = !item.startDate && !item.dueDate
        ? 'Missing start and due dates'
        : !item.startDate
          ? 'Missing start date'
          : 'Missing due date'
      unscheduled.push({ ticket: item, reason })
      continue
    }

    const layout = layoutGanttBar(item.startDate, item.dueDate, range)
    if (layout) scheduled.push({ ticket: item, layout })
    else outOfWindow.push(item)
  }

  return { scheduled, unscheduled, outOfWindow }
}

export function isTicketOverdue(
  dueDate: Date | string | null | undefined,
  status: string,
  today: GanttDateInput = new Date()
): boolean {
  return Boolean(dueDate) && status !== 'DONE' && toCalendarDate(dueDate!).getTime() < toCalendarDate(today).getTime()
}

export function filterGanttTeams<T extends { id: string }>(teams: readonly T[], selectedTeamId: string): T[] {
  return selectedTeamId === 'all' ? [...teams] : teams.filter(team => team.id === selectedTeamId)
}

export function canEditGanttTicket(
  team: GanttPermissionTeam,
  ticket: GanttPermissionTicket,
  currentUser: GanttPermissionUser,
  readOnly = false
): boolean {
  if (readOnly) return false
  const membership = team.members.find(member => member.userId === currentUser.id)
  return can(
    { id: currentUser.id, role: currentUser.role as Role },
    'ticket:update',
    {
      isMember: Boolean(membership),
      isLead: membership?.role === 'LEAD' || membership?.role === 'TEAM_LEAD',
      assigneeId: ticket.assignee?.id,
      createdById: ticket.createdById,
    }
  )
}
