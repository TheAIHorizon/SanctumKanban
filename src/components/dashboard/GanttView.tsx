'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { EditTicketDialog } from '@/components/kanban/EditTicketDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addCalendarDays,
  canEditGanttTicket,
  classifyGanttTickets,
  dateKey,
  differenceInCalendarDays,
  filterGanttTeams,
  getGanttWindow,
  reconcileGanttAnchorForToday,
  shiftGanttAnchor,
  type GanttScale,
} from '@/lib/gantt'
import { getGanttCompletion, layoutGanttCompletion } from '@/lib/gantt-completion'
import { getGanttStart, layoutGanttStart } from '@/lib/gantt-start'
import { useLocalToday } from '@/hooks/useLocalToday'
import { cn, getContrastColor } from '@/lib/utils'
import { SavedTicketGuidance } from '@/components/kanban/SavedTicketGuidance'
import { canReadSavedGuidance } from '@/lib/saved-ticket-guidance'

export interface GanttUser {
  id: string
  firstName: string
  lastName: string
  color: string
}

export interface GanttTeamMember {
  id?: string
  userId: string
  role: string
  user: GanttUser
}

export interface GanttTag {
  id: string
  name: string
  color: string
}

export interface GanttTicketTag {
  tag: GanttTag
}

export interface GanttTicket {
  id: string
  title: string
  description: string | null
  status: 'BACKLOG' | 'DOING' | 'DONE'
  position: number
  teamId: string
  createdById?: string | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  completedAt?: Date | string | null
  startedAt?: Date | string | null
  startDateAutoFilled?: boolean
  assignee: GanttUser | null
  tags?: GanttTicketTag[]
}

export interface GanttTeam {
  id: string
  name: string
  members: GanttTeamMember[]
  tickets: GanttTicket[]
  tags?: GanttTag[]
}

export interface GanttViewProps {
  teams: GanttTeam[]
  currentUser: { id: string; role: string }
  readOnly?: boolean
}

interface Selection {
  teamId: string
  ticketId: string
}


const STATUS_LABELS: Record<GanttTicket['status'], string> = {
  BACKLOG: 'Backlog',
  DOING: 'Doing',
  DONE: 'Done',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatCalendarDate(value: Date | string): string {
  return longDateFormatter.format(new Date(`${dateKey(value)}T00:00:00Z`))
}

function TicketDetailsDialog({
  open,
  onOpenChange,
  ticket,
  teamName,
  today,
  canViewGuidance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: GanttTicket
  teamName: string
  today: Date
  canViewGuidance: boolean
}) {
  const completion = getGanttCompletion(ticket, today)
  const start = getGanttStart(ticket)
  const actualCompletion = ticket.completedAt
    ? formatCalendarDate(ticket.completedAt)
    : completion.kind === 'legacy'
      ? completion.label
      : 'Not completed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{ticket.title}</DialogTitle>
          <DialogDescription>Read-only ticket details for {teamName}.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-muted-foreground">Status</dt>
            <dd>{STATUS_LABELS[ticket.status]}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Assignee</dt>
            <dd>{ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">{ticket.startDateAutoFilled ? 'Automatic start' : 'Planned start'}</dt>
            <dd>{ticket.startDate ? formatCalendarDate(ticket.startDate) : 'Not set'}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Expected end</dt>
            <dd>{ticket.dueDate ? formatCalendarDate(ticket.dueDate) : 'Not set'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-muted-foreground">Actual start (UTC)</dt>
            <dd>{ticket.startedAt ? formatCalendarDate(ticket.startedAt) : 'Not started'}{start.label ? ` · ${start.label}` : ''}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-muted-foreground">Actual completion (UTC)</dt>
            <dd>{actualCompletion}{ticket.completedAt && completion.label ? ` · ${completion.label}` : ''}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-muted-foreground">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap">{ticket.description || 'No description.'}</dd>
          </div>
          {ticket.tags && ticket.tags.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="font-medium text-muted-foreground">Tags</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {ticket.tags.map(({ tag }) => (
                  <span key={tag.id} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: tag.color }}>
                    {tag.name}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {canViewGuidance && <SavedTicketGuidance ticketId={ticket.id} />}
      </DialogContent>
    </Dialog>
  )
}

export function GanttView({ teams, currentUser, readOnly = false }: GanttViewProps) {
  const router = useRouter()
  const today = useLocalToday()
  const previousToday = useRef(today)
  const [anchor, setAnchor] = useState(today)
  const [scale, setScale] = useState<GanttScale>('month')
  const [selectedTeamId, setSelectedTeamId] = useState('all')
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set())
  const [selection, setSelection] = useState<Selection | null>(null)
  const scrollRegion = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(0)

  useEffect(() => {
    const oldToday = previousToday.current
    if (dateKey(oldToday) !== dateKey(today)) {
      setAnchor(value => reconcileGanttAnchorForToday(value, oldToday, today))
      previousToday.current = today
    }
  }, [today])

  useEffect(() => {
    const element = scrollRegion.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth))
    observer.observe(element)
    setViewportWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [teams.length])

  useEffect(() => {
    if (selectedTeamId !== 'all' && !teams.some(team => team.id === selectedTeamId)) {
      setSelectedTeamId('all')
    }
  }, [selectedTeamId, teams])

  const selected = useMemo(() => {
    if (!selection) return null
    const team = teams.find(item => item.id === selection.teamId)
    const ticket = team?.tickets.find(item => item.id === selection.ticketId)
    return team && ticket ? { team, ticket } : null
  }, [selection, teams])

  useEffect(() => {
    if (selection && !selected) setSelection(null)
  }, [selection, selected])

  const windowRange = useMemo(() => getGanttWindow(anchor, scale), [anchor, scale])
  const visibleTeams = useMemo(
    () => filterGanttTeams(teams, selectedTeamId),
    [selectedTeamId, teams]
  )
  const dates = useMemo(
    () => Array.from({ length: windowRange.dayCount }, (_, index) => addCalendarDays(windowRange.start, index)),
    [windowRange]
  )
  const dayWidth = scale === 'month' ? 36 : 72
  const labelWidth = viewportWidth > 0 && viewportWidth < 640 ? 160 : 256
  const timelineWidth = windowRange.dayCount * dayWidth
  const todayOffset = differenceInCalendarDays(today, windowRange.start)
  const showToday = todayOffset >= 0 && todayOffset < windowRange.dayCount
  useEffect(() => {
    if (!scrollRegion.current) return
    scrollRegion.current.scrollLeft = showToday
      ? Math.max(0, (todayOffset + 0.5) * dayWidth - (viewportWidth - labelWidth) / 2)
      : 0
  }, [anchor, scale, viewportWidth, labelWidth, dayWidth, todayOffset, showToday])

  const openTicket = (teamId: string, ticketId: string) => setSelection({ teamId, ticketId })
  const closeTicket = () => setSelection(null)
  const toggleTeam = (teamId: string) => {
    setCollapsedTeams(previous => {
      const next = new Set(previous)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  if (teams.length === 0) {
    return (
      <section aria-label="Gantt chart" className="rounded-lg border p-8 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-semibold">No teams available</h2>
        <p className="mt-1 text-sm text-muted-foreground">There are no visible teams to show in the timeline.</p>
      </section>
    )
  }

  return (
    <section aria-label="Gantt chart" className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1 text-xs font-medium">
            <label htmlFor="gantt-team-filter">Team</label>
            <select
              id="gantt-team-filter"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={selectedTeamId}
              onChange={event => setSelectedTeamId(event.target.value)}
            >
              <option value="all">All visible teams</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1 text-xs font-medium">
            <label htmlFor="gantt-scale">Calendar window</label>
            <select
              id="gantt-scale"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={scale}
              onChange={event => setScale(event.target.value as GanttScale)}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1" aria-label="Timeline navigation">
          <Button variant="outline" size="icon" onClick={() => setAnchor(value => shiftGanttAnchor(value, scale, -1))} aria-label={`Previous ${scale}`}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date(today))}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(value => shiftGanttAnchor(value, scale, 1))} aria-label={`Next ${scale}`}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="w-full text-sm font-medium sm:w-auto" aria-live="polite">
          {formatCalendarDate(windowRange.start)} – {formatCalendarDate(windowRange.end)}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">Solid bars: planned start to expected end · Dashed outline: automatic start to expected end · ● Actual start / Started variance · ◆ Actual finish · Solid red: finished late · Dashed red: overdue, not completed. Differences use UTC calendar dates.</p>
      <div ref={scrollRegion} className="max-w-full overflow-x-auto rounded-lg border bg-card" style={{ containerType: 'inline-size' }} data-testid="gantt-scroll-region">
        <div style={{ width: labelWidth + timelineWidth, minWidth: '100%' }}>
          <div className="flex border-b bg-muted/50">
            <div className="sticky left-0 z-20 flex-shrink-0 border-r bg-muted px-3 py-2 text-xs font-semibold" style={{ width: labelWidth }}>
              Ticket
            </div>
            <div className="relative flex" style={{ width: timelineWidth }}>
              {dates.map(date => {
                const isToday = dateKey(date) === dateKey(today)
                return (
                  <div
                    key={dateKey(date)}
                    className={cn('relative flex-shrink-0 border-r px-1 py-2 text-center text-xs', isToday && 'bg-red-500/10')}
                    style={{ width: dayWidth }}
                    aria-label={`${formatCalendarDate(date)}${isToday ? ', today' : ''}`}
                  >
                    {isToday && <span className="absolute inset-x-0 top-0 h-0.5 bg-red-500" aria-hidden="true" />}
                    <span className="block font-medium">{scale === 'month' ? date.getUTCDate() : dateFormatter.format(date)}</span>
                    <span className="text-muted-foreground">{date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {visibleTeams.map(team => {
            const result = classifyGanttTickets(team.tickets, windowRange, today)
            const collapsed = collapsedTeams.has(team.id)
            const datedCount = result.scheduled.length + result.outOfWindow.length

            return (
              <section key={team.id} aria-labelledby={`gantt-team-${team.id}`}>
                <button
                  type="button"
                  className="sticky left-0 z-20 flex w-full items-center gap-2 border-b bg-muted/80 px-3 py-2 text-left font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ width: '100cqw' }}
                  onClick={() => toggleTeam(team.id)}
                  aria-expanded={!collapsed}
                  aria-controls={`gantt-team-content-${team.id}`}
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span id={`gantt-team-${team.id}`}>{team.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{team.tickets.length} ticket{team.tickets.length === 1 ? '' : 's'}</span>
                </button>

                {!collapsed && (
                  <div id={`gantt-team-content-${team.id}`}>
                    {team.tickets.length === 0 ? (
                      <p className="sticky left-0 border-b px-4 py-6 text-sm text-muted-foreground" style={{ width: '100cqw' }}>No tickets in this team.</p>
                    ) : result.scheduled.length === 0 ? (
                      <p className="sticky left-0 border-b px-4 py-6 text-sm text-muted-foreground" style={{ width: '100cqw' }}>
                        {datedCount === 0
                          ? 'No scheduled tickets. Add both a start date and due date to place a ticket on the timeline.'
                          : `No scheduled tickets in this date range. ${result.outOfWindow.length} dated ticket${result.outOfWindow.length === 1 ? ' is' : 's are'} outside the visible window.`}
                      </p>
                    ) : null}

                    {result.scheduled.map(({ ticket, layout }) => {
                      const visual = layoutGanttCompletion(ticket, today, windowRange)
                      const startVisual = layoutGanttStart(ticket, windowRange)
                      const { completion } = visual
                      const overdue = completion.kind === 'overdue'
                      const color = ticket.assignee?.color || '#64748b'
                      const textColor = getContrastColor(color)
                      const dateLabel = `${formatCalendarDate(ticket.startDate!)} to ${formatCalendarDate(ticket.dueDate!)}`
                      return (
                        <div key={ticket.id} className="flex min-h-16 border-b">
                          <button
                            type="button"
                            className="sticky left-0 z-10 flex flex-shrink-0 flex-col justify-center border-r bg-card px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            style={{ width: labelWidth }}
                            onClick={() => openTicket(team.id, ticket.id)}
                            aria-label={`Open ${ticket.title}, ${STATUS_LABELS[ticket.status]}, ${dateLabel}${completion.label ? `, ${completion.label}` : ''}`}
                          >
                            <span className="truncate text-sm font-medium">{ticket.title}</span>
                            <span className={cn('text-xs text-muted-foreground', overdue && 'font-semibold text-destructive')}>
                              {STATUS_LABELS[ticket.status]}{overdue ? ' · Overdue' : ''}
                            </span>
                            {startVisual.start.label && (
                              <span className={cn('truncate text-[11px] text-muted-foreground', startVisual.start.kind === 'late' && 'text-amber-700 dark:text-amber-400')}>
                                {startVisual.start.label}
                              </span>
                            )}
                            {completion.label && (
                              <span className={cn('truncate text-[11px] text-muted-foreground', (completion.kind === 'late' || overdue) && 'text-destructive')}>
                                {completion.label}
                              </span>
                            )}
                          </button>
                          <div
                            className="relative flex-shrink-0 bg-background"
                            style={{ width: timelineWidth }}
                          >
                            {dates.map(date => <span aria-hidden="true" key={dateKey(date)} className="absolute inset-y-0 border-r" style={{ left: differenceInCalendarDays(date, windowRange.start) * dayWidth, width: dayWidth }} />)}
                            {showToday && <span aria-hidden="true" className="absolute inset-y-0 z-[1] w-0.5 bg-red-500" style={{ left: (todayOffset + 0.5) * dayWidth }} title="Today" />}
                            {layout && (
                              <button
                                type="button"
                                className={cn(
                                  'absolute top-2 z-[2] h-10 overflow-hidden rounded-md px-2 text-left text-xs shadow-sm ring-1 ring-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  ticket.startDateAutoFilled && 'border-2 border-dashed border-foreground/60'
                                )}
                                style={{ left: `${layout.leftPercent}%`, width: `${layout.widthPercent}%`, backgroundColor: color, color: textColor }}
                                onClick={() => openTicket(team.id, ticket.id)}
                                aria-label={`Open ${ticket.title}, ${dateLabel}${layout.clippedStart || layout.clippedEnd ? ', clipped to visible range' : ''}`}
                                title={ticket.startDateAutoFilled
                                  ? `${ticket.title} · Automatic start to expected end · ${dateLabel}`
                                  : `${ticket.title} · ${dateLabel}`}
                              >
                                <span className="block truncate font-semibold">{layout.clippedStart ? '← ' : ''}{ticket.title}{layout.clippedEnd ? ' →' : ''}</span>
                                <span className="block truncate opacity-90">{STATUS_LABELS[ticket.status]}{overdue ? ' · Overdue' : ''}</span>
                              </button>
                            )}
                            {startVisual.tail && (
                              <span
                                className={cn(
                                  'absolute top-3 z-[3] h-1',
                                  startVisual.tail.kind === 'late' ? 'bg-amber-600' : 'bg-sky-500/50'
                                )}
                                style={{ left: `${startVisual.tail.leftPercent}%`, width: `${startVisual.tail.widthPercent}%` }}
                                title={startVisual.start.label || undefined}
                                aria-hidden="true"
                              />
                            )}
                            {startVisual.marker && (
                              <button
                                type="button"
                                className="absolute top-[8px] z-[4] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-blue-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                style={{ left: `${startVisual.marker.leftPercent}%` }}
                                onClick={() => openTicket(team.id, ticket.id)}
                                aria-label={`Actual start ${formatCalendarDate(startVisual.marker.date)}${startVisual.start.label ? `, ${startVisual.start.label}` : ''}`}
                                title={`Actual start: ${formatCalendarDate(startVisual.marker.date)}${startVisual.start.label ? ` · ${startVisual.start.label}` : ''}`}
                              />
                            )}
                            {visual.tail?.kind === 'early' && layout && (
                              <span
                                data-testid="gantt-early-remainder"
                                aria-hidden="true"
                                className="pointer-events-none absolute top-2 z-[3] h-10 rounded-r-md bg-background/70"
                                style={{ left: `${visual.tail.leftPercent}%`, width: `${Math.min(100 - visual.tail.leftPercent, visual.tail.widthPercent + (visual.tail.clippedEnd ? 0 : 50 / windowRange.dayCount))}%` }}
                              />
                            )}
                            {visual.tail && (
                              <span
                                className={cn(
                                  'absolute top-7 z-[3] h-1',
                                  visual.tail.kind === 'late' && 'bg-red-600',
                                  visual.tail.kind === 'early' && 'bg-slate-500/25',
                                  visual.tail.kind === 'overdue' && 'h-0 border-t-2 border-dashed border-red-600'
                                )}
                                style={{ left: `${visual.tail.leftPercent}%`, width: `${visual.tail.widthPercent}%` }}
                                title={completion.label || undefined}
                                aria-hidden="true"
                              >
                                <span className={cn('absolute left-1 top-6 whitespace-nowrap text-[10px] font-semibold', (visual.tail.kind === 'late' || visual.tail.kind === 'overdue') ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground')}>
                                  {completion.label}
                                </span>
                              </span>
                            )}
                            {visual.marker && (
                              <button
                                type="button"
                                className="absolute top-[22px] z-[4] h-3 w-3 -translate-x-1/2 rotate-45 border-2 border-background bg-emerald-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                style={{ left: `${visual.marker.leftPercent}%` }}
                                onClick={() => openTicket(team.id, ticket.id)}
                                aria-label={`Actual completion ${formatCalendarDate(visual.marker.date)}${completion.label ? `, ${completion.label}` : ''}`}
                                title={`Actual completion: ${formatCalendarDate(visual.marker.date)}${completion.label ? ` · ${completion.label}` : ''}`}
                              />
                            )}
                            {visual.marker && (completion.kind === 'on-time' || completion.kind === 'completed') && (
                              <span className="absolute top-[52px] z-[4] -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-emerald-700 dark:text-emerald-400" style={{ left: `${visual.marker.leftPercent}%` }}>
                                {completion.label}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {result.outOfWindow.length > 0 && result.scheduled.length > 0 && (
                      <p className="sticky left-0 border-b px-4 py-2 text-xs text-muted-foreground" style={{ width: '100cqw' }}>
                        {result.outOfWindow.length} dated ticket{result.outOfWindow.length === 1 ? '' : 's'} outside this date range.
                      </p>
                    )}

                    {result.unscheduled.length > 0 && (
                      <section aria-labelledby={`gantt-unscheduled-${team.id}`} className="sticky left-0 border-b bg-muted/20 p-3" style={{ width: '100cqw' }}>
                        <h3 id={`gantt-unscheduled-${team.id}`} className="text-sm font-semibold">Unscheduled</h3>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {result.unscheduled.map(({ ticket, reason }) => {
                            const completion = getGanttCompletion(ticket, today)
                            const start = getGanttStart(ticket)
                            return (
                              <button
                                type="button"
                                key={ticket.id}
                                className="rounded-md border bg-card p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openTicket(team.id, ticket.id)}
                                aria-label={`Open ${ticket.title}, ${reason}${completion.label ? `, ${completion.label}` : ''}`}
                              >
                                <span className="block truncate text-sm font-medium">{ticket.title}</span>
                                <span className="block text-xs text-muted-foreground">{reason}</span>
                                {completion.label && (
                                  <span className={cn('block text-xs text-muted-foreground', completion.kind === 'late' && 'text-destructive')}>
                                    {completion.actualDate ? `${completion.label} · ${formatCalendarDate(completion.actualDate)}` : completion.label}
                                  </span>
                                )}
                                {start.label && (
                                  <span className="block text-xs text-muted-foreground">
                                    {start.label} · {formatCalendarDate(start.actualDate!)}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {selected && canEditGanttTicket(selected.team, selected.ticket, currentUser, readOnly) ? (
        <EditTicketDialog
          open
          onOpenChange={open => { if (!open) closeTicket() }}
          ticket={{
            ...selected.ticket,
            startDate: selected.ticket.startDate ? dateKey(selected.ticket.startDate) : null,
            dueDate: selected.ticket.dueDate ? dateKey(selected.ticket.dueDate) : null,
          }}
          members={selected.team.members.map(member => ({ ...member, id: member.id || `${selected.team.id}:${member.userId}` }))}
          tags={selected.team.tags || []}
          onTicketUpdated={() => {
            closeTicket()
            router.refresh()
          }}
        />
      ) : selected ? (
        <TicketDetailsDialog
          open
          onOpenChange={open => { if (!open) closeTicket() }}
          ticket={selected.ticket}
          teamName={selected.team.name}
          today={today}
          canViewGuidance={canReadSavedGuidance(currentUser.role, selected.team.members.some(member => member.userId === currentUser.id))}
        />
      ) : null}
    </section>
  )
}
