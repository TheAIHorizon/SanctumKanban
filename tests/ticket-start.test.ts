import test from 'node:test'
import assert from 'node:assert/strict'

import {
  planStartForNewTicket,
  planStartTransition,
} from '../src/lib/ticket-start'

const now = new Date('2026-09-17T23:30:00.000Z')
const firstStart = new Date('2026-09-15T12:00:00.000Z')
const planned = new Date('2026-09-10T00:00:00.000Z')
const automatic = new Date('2026-09-15T00:00:00.000Z')

test('direct DOING creation records actual start and auto-fills a missing UTC start day', () => {
  assert.deepEqual(planStartForNewTicket('DOING', null, now), {
    startedAt: now,
    startDate: new Date('2026-09-17T00:00:00.000Z'),
    startDateAutoFilled: true,
    historyDetails: {
      startedAt: now.toISOString(),
      startDateAutoFilled: true,
      autoFilledStartDate: '2026-09-17',
    },
  })
})

test('direct DOING creation preserves a genuine planned start', () => {
  assert.deepEqual(planStartForNewTicket('DOING', planned, now), {
    startedAt: now,
    startDate: planned,
    startDateAutoFilled: false,
    historyDetails: {
      startedAt: now.toISOString(),
      startDateAutoFilled: false,
    },
  })
})

test('BACKLOG and direct DONE creation do not invent an actual start', () => {
  for (const status of ['BACKLOG', 'DONE'] as const) {
    assert.deepEqual(planStartForNewTicket(status, null, now), {
      startedAt: null,
      startDate: null,
      startDateAutoFilled: false,
      historyDetails: undefined,
    })
  }
})

test('first transition into DOING records server time and auto-fills an absent start', () => {
  assert.deepEqual(planStartTransition({
    currentStatus: 'BACKLOG',
    currentStartedAt: null,
    currentStartDate: null,
    currentStartDateAutoFilled: false,
    requestedStatus: 'DOING',
    nextStartDate: null,
    startDateWasProvided: false,
    now,
  }), {
    shouldWriteStartedAt: true,
    startedAt: now,
    startDate: new Date('2026-09-17T00:00:00.000Z'),
    startDateAutoFilled: true,
    shouldWriteSchedule: true,
    historyDetails: {
      startedAt: now.toISOString(),
      startDateAutoFilled: true,
      autoFilledStartDate: '2026-09-17',
    },
  })
})

test('repeat DOING, unrelated edits, backlog returns, and reopen retain the first actual start', () => {
  for (const [currentStatus, requestedStatus] of [
    ['DOING', 'DOING'],
    ['DOING', undefined],
    ['DOING', 'BACKLOG'],
    ['BACKLOG', 'DOING'],
    ['DONE', 'DOING'],
  ] as const) {
    const plan = planStartTransition({
      currentStatus,
      currentStartedAt: firstStart,
      currentStartDate: automatic,
      currentStartDateAutoFilled: true,
      requestedStatus,
      nextStartDate: automatic,
      startDateWasProvided: false,
      now,
    })
    assert.equal(plan.startedAt, firstStart)
    assert.equal(plan.shouldWriteStartedAt, false)
    assert.equal(plan.startDateAutoFilled, true)
    assert.equal(plan.historyDetails, undefined)
  }
})

test('explicitly changing or clearing a planned start turns off the automatic flag', () => {
  const changed = planStartTransition({
    currentStatus: 'DOING', currentStartedAt: firstStart,
    currentStartDate: automatic, currentStartDateAutoFilled: true,
    requestedStatus: undefined, nextStartDate: planned,
    startDateWasProvided: true, now,
  })
  assert.equal(changed.startDateAutoFilled, false)
  assert.equal(changed.shouldWriteSchedule, true)

  const cleared = planStartTransition({
    currentStatus: 'DOING', currentStartedAt: firstStart,
    currentStartDate: automatic, currentStartDateAutoFilled: true,
    requestedStatus: undefined, nextStartDate: null,
    startDateWasProvided: true, now,
  })
  assert.equal(cleared.startDateAutoFilled, false)
})

test('an editor round-trip of the unchanged automatic date retains the automatic flag', () => {
  const plan = planStartTransition({
    currentStatus: 'DOING', currentStartedAt: firstStart,
    currentStartDate: automatic, currentStartDateAutoFilled: true,
    requestedStatus: undefined, nextStartDate: new Date(automatic),
    startDateWasProvided: true, now,
  })
  assert.equal(plan.startDateAutoFilled, true)
  assert.equal(plan.shouldWriteSchedule, false)
})
