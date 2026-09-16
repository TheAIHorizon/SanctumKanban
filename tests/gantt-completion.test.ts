import test from 'node:test'
import assert from 'node:assert/strict'

import { getGanttCompletion, layoutGanttCompletion } from '../src/lib/gantt-completion'
import { classifyGanttTickets } from '../src/lib/gantt'

test('classifies an early completion by UTC calendar days', () => {
  assert.deepEqual(
    getGanttCompletion({ status: 'DONE', dueDate: '2026-03-10', completedAt: '2026-03-08T23:30:00Z' }, '2026-03-20'),
    { kind: 'early', actualDate: '2026-03-08', comparisonDays: -2, label: '2 days early' }
  )
})

test('classifies late and on-time completion without fractional hours', () => {
  assert.deepEqual(
    getGanttCompletion({ status: 'DONE', dueDate: '2026-03-10', completedAt: '2026-03-13T01:00:00Z' }, '2026-03-20'),
    { kind: 'late', actualDate: '2026-03-13', comparisonDays: 3, label: '3 days late' }
  )
  assert.deepEqual(
    getGanttCompletion({ status: 'DONE', dueDate: '2026-03-10', completedAt: '2026-03-10T23:59:59Z' }, '2026-03-20'),
    { kind: 'on-time', actualDate: '2026-03-10', comparisonDays: 0, label: 'Completed on time' }
  )
})

test('keeps unfinished overdue work distinct from actual completion', () => {
  assert.deepEqual(
    getGanttCompletion({ status: 'DOING', dueDate: '2026-03-10', completedAt: null }, '2026-03-13'),
    { kind: 'overdue', actualDate: null, comparisonDays: 3, label: 'Overdue—not completed' }
  )
  assert.deepEqual(
    getGanttCompletion({ status: 'DOING', dueDate: '2026-03-13', completedAt: null }, '2026-03-13'),
    { kind: 'incomplete', actualDate: null, comparisonDays: null, label: null }
  )
})

test('labels legacy done tickets without inventing an actual date', () => {
  assert.deepEqual(
    getGanttCompletion({ status: 'DONE', dueDate: '2026-03-10', completedAt: null }, '2026-03-13'),
    { kind: 'legacy', actualDate: null, comparisonDays: null, label: 'Completion date not recorded' }
  )
})

test('a completion without a due date has no early or late comparison', () => {
  assert.deepEqual(
    getGanttCompletion({ status: 'DONE', dueDate: null, completedAt: '2026-03-11T14:00:00Z' }, '2026-03-13'),
    { kind: 'completed', actualDate: '2026-03-11', comparisonDays: null, label: 'Completed' }
  )
})

test('clips completion geometry and can show only the actual marker in the window', () => {
  const actualOnly = layoutGanttCompletion(
    { status: 'DONE', dueDate: '2026-02-20', completedAt: '2026-03-03T12:00:00Z' },
    '2026-03-10',
    { start: '2026-03-01', end: '2026-03-07' }
  )

  assert.deepEqual(actualOnly.marker, { date: '2026-03-03', leftPercent: 2.5 / 7 * 100 })
  assert.deepEqual(actualOnly.tail, {
    kind: 'late',
    leftPercent: 0,
    widthPercent: 2.5 / 7 * 100,
    clippedStart: true,
    clippedEnd: false,
  })
})

test('keeps a scheduled ticket when only its actual completion is in the window', () => {
  const result = classifyGanttTickets([
    {
      id: 'actual-only',
      status: 'DONE',
      startDate: '2026-02-01',
      dueDate: '2026-02-20',
      completedAt: '2026-03-03T12:00:00Z',
    },
  ], { start: '2026-03-01', end: '2026-03-07' }, '2026-03-10')

  assert.equal(result.scheduled.length, 1)
  assert.equal(result.scheduled[0].ticket.id, 'actual-only')
  assert.equal(result.scheduled[0].layout, null)
  assert.deepEqual(result.outOfWindow, [])
})

test('keeps unfinished overdue work when only its due-to-today tail crosses the window', () => {
  const result = classifyGanttTickets([
    {
      id: 'overdue-tail',
      status: 'DOING',
      startDate: '2026-02-01',
      dueDate: '2026-02-20',
      completedAt: null,
    },
  ], { start: '2026-03-01', end: '2026-03-07' }, '2026-03-05')

  assert.equal(result.scheduled.length, 1)
  assert.equal(result.scheduled[0].layout, null)
})
