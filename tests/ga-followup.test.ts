import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assigneeFromSelection, canFilterMyTickets } from '../src/lib/ticket-form-options'

test('Unassigned selections produce null; member IDs remain unchanged', () => {
  assert.equal(assigneeFromSelection('unassigned'), null)
  assert.equal(assigneeFromSelection(''), null)
  assert.equal(assigneeFromSelection('member-id'), 'member-id')
})

test('My Tickets is available only for a board membership', () => {
  assert.equal(canFilterMyTickets([{ userId: 'member' }], 'member'), true)
  assert.equal(canFilterMyTickets([{ userId: 'member' }], 'other'), false)
  assert.equal(canFilterMyTickets([], 'admin'), false)
})

test('create and edit serialize assignee choices consistently', () => {
  for (const file of ['CreateTicketDialog', 'EditTicketDialog']) {
    assert.match(readFileSync(`src/components/kanban/${file}.tsx`, 'utf8'), /assigneeId: assigneeFromSelection\(assigneeId\)/)
  }
})

test('My Tickets control and keyboard shortcut are membership-gated', () => {
  assert.match(readFileSync('src/components/kanban/FilterBar.tsx', 'utf8'), /canFilterMyTickets\(members, currentUserId\) &&/)
  assert.match(readFileSync('src/components/kanban/TeamKanban.tsx', 'utf8'), /case 'm':\s*if \(!canUseMyTickets\) break/)
})
