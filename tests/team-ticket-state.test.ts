import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTicketPositions } from '../src/lib/team-ticket-state'

test('batch reordering updates hidden tickets and preserves ticket details', () => {
  const tickets = [
    { id: 'visible', position: 1, title: 'Visible' },
    { id: 'hidden', position: 2, title: 'Hidden' },
    { id: 'other', position: 1, title: 'Other column' },
  ]
  const updated = applyTicketPositions(tickets, [{ id: 'hidden', position: 1 }, { id: 'visible', position: 2 }])
  assert.deepEqual(updated, [
    { id: 'visible', position: 2, title: 'Visible' },
    { id: 'hidden', position: 1, title: 'Hidden' },
    { id: 'other', position: 1, title: 'Other column' },
  ])
  assert.equal(tickets[0].position, 1)
  assert.equal(updated[2], tickets[2])
})
