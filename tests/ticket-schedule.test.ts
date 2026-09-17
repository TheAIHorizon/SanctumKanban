import test from 'node:test'
import assert from 'node:assert/strict'

import { validateTicketSchedule } from '../src/lib/ticket-schedule'

const emptySchedule = { startDate: null, dueDate: null }

test('date-only schedule values parse as UTC calendar midnights', () => {
  const result = validateTicketSchedule(
    { startDate: '2026-09-15', dueDate: '2026-09-15' },
    emptySchedule,
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.schedule.startDate?.toISOString(), '2026-09-15T00:00:00.000Z')
  assert.equal(result.schedule.dueDate?.toISOString(), '2026-09-15T00:00:00.000Z')
  assert.deepEqual(result.updates, result.schedule)
})

test('omitted PATCH dates are preserved while explicit null clears a date', () => {
  const existing = {
    startDate: new Date('2026-09-10T00:00:00.000Z'),
    dueDate: new Date('2026-09-20T12:00:00.000Z'),
  }

  const omitted = validateTicketSchedule({}, existing)
  assert.deepEqual(omitted, {
    ok: true,
    schedule: existing,
    updates: {},
  })

  const cleared = validateTicketSchedule({ startDate: null }, existing)
  assert.equal(cleared.ok, true)
  if (!cleared.ok) return
  assert.deepEqual(cleared.schedule, { startDate: null, dueDate: existing.dueDate })
  assert.deepEqual(cleared.updates, { startDate: null })
})

test('invalid date values and impossible calendar dates are rejected', () => {
  for (const input of [
    { startDate: 123 },
    { startDate: '' },
    { startDate: '09/15/2026' },
    { startDate: '2026-02-30' },
    { dueDate: false },
    { dueDate: '' },
    { dueDate: 'tomorrow' },
    { dueDate: '2026-13-01' },
    { dueDate: '2026-02-30T12:00:00Z' },
    { dueDate: '2026-09-15T24:00:00Z' },
  ]) {
    const result = validateTicketSchedule(input, emptySchedule)
    assert.equal(result.ok, false, JSON.stringify(input))
    if (!result.ok) assert.match(result.error, /startDate|dueDate/)
  }
})

test('dueDate accepts strict timezone-qualified ISO timestamps for existing API clients', () => {
  const result = validateTicketSchedule(
    { dueDate: '2026-09-20T16:30:00-04:00' },
    emptySchedule,
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.schedule.dueDate?.toISOString(), '2026-09-20T20:30:00.000Z')
})

test('startDate remains calendar-date-only', () => {
  const result = validateTicketSchedule(
    { startDate: '2026-09-15T00:00:00.000Z' },
    emptySchedule,
  )

  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /startDate/)
})

test('an unchanged automatic start may remain after an overdue due date', () => {
  const existing = {
    startDate: new Date('2026-09-17T00:00:00.000Z'),
    dueDate: new Date('2026-09-10T00:00:00.000Z'),
    startDateAutoFilled: true,
  }

  assert.equal(validateTicketSchedule({}, existing).ok, true)
  assert.equal(validateTicketSchedule({ startDate: '2026-09-17' }, existing).ok, true)

  const manualChange = validateTicketSchedule({ startDate: '2026-09-16' }, existing)
  assert.equal(manualChange.ok, false)
})

test('merged schedule rejects a start date after due date but allows the same day', () => {
  const existing = {
    startDate: new Date('2026-09-10T00:00:00.000Z'),
    dueDate: new Date('2026-09-20T00:00:00.000Z'),
    startDateAutoFilled: false,
  }

  const reversedByStart = validateTicketSchedule({ startDate: '2026-09-21' }, existing)
  assert.equal(reversedByStart.ok, false)
  if (!reversedByStart.ok) assert.match(reversedByStart.error, /on or before/i)

  const reversedByDue = validateTicketSchedule({ dueDate: '2026-09-09' }, existing)
  assert.equal(reversedByDue.ok, false)

  const sameDay = validateTicketSchedule(
    { startDate: '2026-09-15', dueDate: '2026-09-15' },
    emptySchedule,
  )
  assert.equal(sameDay.ok, true)
})
