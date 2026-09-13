import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTicketReorderPlan,
  buildVisibleTicketPositionUpdates,
  canReorderTicket,
  validateTicketReorder,
} from '../src/lib/ticket-reorder'

test('reorders against the complete column while preserving filtered-out tickets', () => {
  const plan = buildTicketReorderPlan(
    [
      { id: 'visible-a', position: 1 },
      { id: 'hidden', position: 2 },
      { id: 'visible-b', position: 3 },
      { id: 'visible-c', position: 4 },
    ],
    'visible-c',
    'visible-a'
  )

  assert.deepEqual(plan, [
    { id: 'visible-c', position: 1 },
    { id: 'visible-a', position: 2 },
    { id: 'hidden', position: 3 },
    { id: 'visible-b', position: 4 },
  ])
})

test('rejects a reorder target from another team', () => {
  const result = validateTicketReorder(
    { id: 'ticket', teamId: 'team-a', status: 'BACKLOG', archived: false },
    { id: 'target', teamId: 'team-b', status: 'BACKLOG', archived: false }
  )

  assert.deepEqual(result, { ok: false, error: 'Tickets must belong to the same team' })
})

test('rejects archived ticket writes', () => {
  const result = validateTicketReorder(
    { id: 'ticket', teamId: 'team-a', status: 'BACKLOG', archived: true },
    { id: 'target', teamId: 'team-a', status: 'BACKLOG', archived: false }
  )

  assert.deepEqual(result, { ok: false, error: 'Archived tickets cannot be reordered' })
})

test('rejects cross-column reorder requests', () => {
  const result = validateTicketReorder(
    { id: 'ticket', teamId: 'team-a', status: 'BACKLOG', archived: false },
    { id: 'target', teamId: 'team-a', status: 'DOING', archived: false }
  )

  assert.deepEqual(result, { ok: false, error: 'Tickets must belong to the same column' })
})

test('member cannot reorder an owned ticket after leaving its team', () => {
  assert.equal(
    canReorderTicket(
      { id: 'member', role: 'MEMBER' },
      {
        isMember: false,
        isLead: false,
        assigneeId: 'member',
        createdById: 'member',
      }
    ),
    false
  )
})

test('optimistic reorder reuses visible position slots without overwriting hidden slots', () => {
  const updates = buildVisibleTicketPositionUpdates(
    [
      { id: 'visible-a', position: 1 },
      { id: 'visible-b', position: 3 },
      { id: 'visible-c', position: 4 },
    ],
    'visible-c',
    'visible-a'
  )

  assert.deepEqual(updates, [
    { id: 'visible-c', position: 1 },
    { id: 'visible-a', position: 3 },
    { id: 'visible-b', position: 4 },
  ])
})