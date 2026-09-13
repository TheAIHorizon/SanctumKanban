import test from 'node:test'
import assert from 'node:assert/strict'
import { can } from '../src/lib/permissions'

test('removed ticket creator or assignee cannot edit or archive without team membership', () => {
  for (const action of ['ticket:update', 'ticket:archive'] as const) {
    assert.equal(can({ id: 'former', role: 'MEMBER' }, action, { isMember: false, createdById: 'former', assigneeId: 'former' }), false)
  }
})

test('observer-shaped archive views remain read-only even with original ownership and membership', () => {
  for (const action of ['ticket:update', 'ticket:archive'] as const) {
    assert.equal(can({ id: 'student', role: 'OBSERVER' }, action, { isMember: true, isLead: true, createdById: 'student', assigneeId: 'student' }), false)
    assert.equal(can({ id: 'student', role: 'MEMBER' }, action, { isMember: true, createdById: 'student' }), true)
  }
})
