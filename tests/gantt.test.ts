import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addCalendarDays,
  canEditGanttTicket,
  classifyGanttTickets,
  dateKey,
  differenceInCalendarDays,
  filterGanttTeams,
  getGanttWindow,
  isTicketOverdue,
  layoutGanttBar,
  reconcileGanttAnchorForToday,
  shiftGanttAnchor,
} from '../src/lib/gantt'

const ticket = (overrides: Record<string, unknown> = {}) => ({
  id: 'ticket-1',
  title: 'Plan lesson',
  description: null,
  status: 'DOING',
  position: 0,
  teamId: 'team-1',
  startDate: '2026-03-08',
  dueDate: '2026-03-08',
  assignee: null,
  ...overrides,
})

const team = {
  id: 'team-1',
  name: 'Blue team',
  members: [
    {
      userId: 'member-1',
      role: 'MEMBER',
      user: { id: 'member-1', firstName: 'Mina', lastName: 'Lee', color: '#2563eb' },
    },
    {
      userId: 'lead-1',
      role: 'LEAD',
      user: { id: 'lead-1', firstName: 'Tess', lastName: 'Lead', color: '#111827' },
    },
  ],
  tickets: [ticket()],
}

test('date-only arithmetic stays on calendar days across a DST boundary', () => {
  const start = '2026-03-07'
  assert.equal(dateKey(addCalendarDays(start, 1)), '2026-03-08')
  assert.equal(dateKey(addCalendarDays(start, 2)), '2026-03-09')
  assert.equal(differenceInCalendarDays('2026-03-09', start), 2)
})

test('date keys keep exact dates but normalize zoned timestamps to their UTC calendar day', () => {
  assert.equal(dateKey('2026-09-16'), '2026-09-16')
  assert.equal(dateKey('2026-09-16T23:30:00-02:00'), '2026-09-17')
  assert.equal(dateKey('2026-09-16T00:30:00+02:00'), '2026-09-15')
  assert.equal(
    dateKey('2026-09-16T23:30:00-02:00'),
    dateKey(new Date('2026-09-16T23:30:00-02:00'))
  )
})

test('date keys safely reject invalid, partial, and unzoned strings', () => {
  assert.equal(dateKey('2026-02-30'), null)
  assert.equal(dateKey('2026-09-16 extra'), null)
  assert.equal(dateKey('2026-09-16T12:00:00'), null)
  assert.equal(dateKey('not-a-date'), null)
})

test('a new local day follows an anchor on old today but preserves manual navigation', () => {
  const previousToday = new Date('2026-09-16T00:00:00Z')
  const nextToday = new Date('2026-09-17T00:00:00Z')

  assert.equal(dateKey(reconcileGanttAnchorForToday(previousToday, previousToday, nextToday)), '2026-09-17')
  assert.equal(dateKey(reconcileGanttAnchorForToday('2026-10-01', previousToday, nextToday)), '2026-10-01')
})

test('week and month windows use inclusive calendar boundaries', () => {
  const week = getGanttWindow('2026-09-16', 'week')
  assert.deepEqual([dateKey(week.start), dateKey(week.end), week.dayCount], ['2026-09-14', '2026-09-20', 7])

  const month = getGanttWindow('2024-02-15', 'month')
  assert.deepEqual([dateKey(month.start), dateKey(month.end), month.dayCount], ['2024-02-01', '2024-02-29', 29])
  assert.equal(dateKey(shiftGanttAnchor('2024-01-31', 'month', 1)), '2024-02-29')
})

test('bar layout is inclusive, clips to the visible range, and keeps same-day bars visible', () => {
  const range = { start: '2026-03-01', end: '2026-03-07' }
  assert.deepEqual(layoutGanttBar('2026-03-03', '2026-03-03', range), {
    leftPercent: 2 / 7 * 100,
    widthPercent: 1 / 7 * 100,
    clippedStart: false,
    clippedEnd: false,
  })
  assert.deepEqual(layoutGanttBar('2026-02-27', '2026-03-02', range), {
    leftPercent: 0,
    widthPercent: 2 / 7 * 100,
    clippedStart: true,
    clippedEnd: false,
  })
  assert.equal(layoutGanttBar('2026-03-08', '2026-03-09', range), null)
})

test('tickets missing either endpoint are unscheduled while dated out-of-window tickets stay separate', () => {
  const result = classifyGanttTickets([
    ticket({ id: 'in' }),
    ticket({ id: 'no-start', startDate: null }),
    ticket({ id: 'no-due', dueDate: null }),
    ticket({ id: 'outside', startDate: '2026-04-01', dueDate: '2026-04-02' }),
  ], { start: '2026-03-01', end: '2026-03-31' })

  assert.deepEqual(result.scheduled.map(item => item.ticket.id), ['in'])
  assert.deepEqual(result.unscheduled.map(item => [item.ticket.id, item.reason]), [
    ['no-start', 'Missing start date'],
    ['no-due', 'Missing due date'],
  ])
  assert.deepEqual(result.outOfWindow.map(item => item.id), ['outside'])
})

test('done tickets are never overdue and open tickets become overdue after their due date', () => {
  assert.equal(isTicketOverdue('2026-03-08', 'DOING', '2026-03-09'), true)
  assert.equal(isTicketOverdue('2026-03-08', 'DONE', '2026-03-09'), false)
  assert.equal(isTicketOverdue('2026-03-09', 'BACKLOG', '2026-03-09'), false)
  assert.equal(isTicketOverdue(null, 'DOING', '2026-03-09'), false)
})

test('team filtering only selects from the teams passed to the helper', () => {
  const other = { ...team, id: 'team-2', name: 'Green team' }
  assert.deepEqual(filterGanttTeams([team, other], 'all').map(item => item.id), ['team-1', 'team-2'])
  assert.deepEqual(filterGanttTeams([team, other], 'team-2').map(item => item.id), ['team-2'])
  assert.deepEqual(filterGanttTeams([team], 'hidden-team'), [])
})

test('ticket edit permission uses membership, creator, assignee, lead and admin facts', () => {
  assert.equal(canEditGanttTicket(team, ticket({ createdById: 'member-1' }), { id: 'member-1', role: 'MEMBER' }), true)
  assert.equal(canEditGanttTicket(team, ticket({ assignee: team.members[0].user }), { id: 'member-1', role: 'MEMBER' }), true)
  assert.equal(canEditGanttTicket(team, ticket(), { id: 'lead-1', role: 'TEAM_LEAD' }), true)
  assert.equal(canEditGanttTicket(team, ticket(), { id: 'outsider', role: 'MEMBER' }), false)
  assert.equal(canEditGanttTicket(team, ticket(), { id: 'admin', role: 'ADMIN' }), true)
  assert.equal(canEditGanttTicket(team, ticket(), { id: 'admin', role: 'ADMIN' }, true), false)
})
