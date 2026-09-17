import test from 'node:test'
import assert from 'node:assert/strict'

import { getGanttStart, layoutGanttStart } from '../src/lib/gantt-start'
import { classifyGanttTickets } from '../src/lib/gantt'

test('compares actual start with a genuine planned start by UTC calendar day', () => {
  assert.deepEqual(getGanttStart({
    startDate: '2026-03-10', startedAt: '2026-03-08T23:30:00Z', startDateAutoFilled: false,
  }), {
    kind: 'early', actualDate: '2026-03-08', comparisonDays: -2, label: 'Started 2 days early',
  })
  assert.equal(getGanttStart({
    startDate: '2026-03-10', startedAt: '2026-03-13T01:00:00Z', startDateAutoFilled: false,
  }).label, 'Started 3 days late')
  assert.equal(getGanttStart({
    startDate: '2026-03-10', startedAt: '2026-03-10T23:59:00Z', startDateAutoFilled: false,
  }).label, 'Started on plan')
})

test('an automatic calendar start is labeled as having no original plan', () => {
  assert.deepEqual(getGanttStart({
    startDate: '2026-03-10', startedAt: '2026-03-10T12:00:00Z', startDateAutoFilled: true,
  }), {
    kind: 'automatic', actualDate: '2026-03-10', comparisonDays: null,
    label: 'Started · no original plan',
  })
})

test('actual start without a schedule is still informative but remains Unscheduled', () => {
  assert.equal(getGanttStart({ startDate: null, startedAt: '2026-03-10T12:00:00Z' }).label, 'Started · no original plan')
  const result = classifyGanttTickets([{
    id: 'incomplete', status: 'DOING', startDate: null, dueDate: '2026-03-20',
    startedAt: '2026-03-10T12:00:00Z', startDateAutoFilled: false,
  }], { start: '2026-03-01', end: '2026-03-31' })
  assert.equal(result.scheduled.length, 0)
  assert.equal(result.unscheduled[0].ticket.id, 'incomplete')
})

test('lays out a distinct actual-start marker and variance tail', () => {
  const layout = layoutGanttStart({
    startDate: '2026-03-10', startedAt: '2026-03-13T12:00:00Z', startDateAutoFilled: false,
  }, { start: '2026-03-01', end: '2026-03-31' })
  assert.equal(layout.marker?.date, '2026-03-13')
  assert.equal(layout.tail?.kind, 'late')
  assert.ok((layout.tail?.widthPercent ?? 0) > 0)
})

test('scheduled classification includes actual start variance outside the planned window', () => {
  const result = classifyGanttTickets([{
    id: 'actual-start-only', status: 'DOING',
    startDate: '2026-02-10', dueDate: '2026-02-20',
    startedAt: '2026-03-03T12:00:00Z', startDateAutoFilled: false,
  }], { start: '2026-03-01', end: '2026-03-07' }, '2026-02-20')
  assert.equal(result.scheduled[0].ticket.id, 'actual-start-only')
  assert.equal(result.scheduled[0].layout, null)
})
