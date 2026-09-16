import test from 'node:test'
import assert from 'node:assert/strict'

import {
  completionForNewTicket,
  isTicketStatus,
  planCompletionTransition,
} from '../src/lib/ticket-completion'

const now = new Date('2026-09-16T18:30:00.000Z')
const original = new Date('2026-09-15T12:00:00.000Z')

test('ticket status validation accepts only the persisted enum values', () => {
  assert.equal(isTicketStatus('BACKLOG'), true)
  assert.equal(isTicketStatus('DOING'), true)
  assert.equal(isTicketStatus('DONE'), true)
  assert.equal(isTicketStatus('done'), false)
  assert.equal(isTicketStatus('INVALID'), false)
  assert.equal(isTicketStatus(null), false)
})

test('new DONE tickets receive the server completion time', () => {
  assert.equal(completionForNewTicket('DONE', now), now)
  assert.equal(completionForNewTicket('BACKLOG', now), null)
})

test('entering DONE records the server time and completion history detail', () => {
  const plan = planCompletionTransition('DOING', null, 'DONE', now)

  assert.deepEqual(plan, {
    shouldWrite: true,
    completedAt: now,
    historyDetails: { completedAt: now.toISOString() },
  })
})

test('repeated DONE and unrelated edits preserve the exact completion value including legacy null', () => {
  assert.deepEqual(planCompletionTransition('DONE', original, 'DONE', now), {
    shouldWrite: false,
    completedAt: original,
    historyDetails: undefined,
  })
  assert.deepEqual(planCompletionTransition('DONE', null, 'DONE', now), {
    shouldWrite: false,
    completedAt: null,
    historyDetails: undefined,
  })
  assert.deepEqual(planCompletionTransition('DONE', original, undefined, now), {
    shouldWrite: false,
    completedAt: original,
    historyDetails: undefined,
  })
})

test('leaving DONE clears current completion and retains the old value in history', () => {
  assert.deepEqual(planCompletionTransition('DONE', original, 'DOING', now), {
    shouldWrite: true,
    completedAt: null,
    historyDetails: { previousCompletedAt: original.toISOString() },
  })
  assert.deepEqual(planCompletionTransition('DONE', null, 'BACKLOG', now), {
    shouldWrite: true,
    completedAt: null,
    historyDetails: { previousCompletedAt: null },
  })
})
