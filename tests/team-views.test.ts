import test from 'node:test'
import assert from 'node:assert/strict'
import { teamsForView } from '../src/lib/team-views'

const teams = [
  { id: 'other', members: [{ userId: 'someone' }] },
  { id: 'mine', members: [{ userId: 'student' }] },
  { id: 'also-mine', members: [{ userId: 'student' }] },
]

test('detailed view puts own teams first without mutating input or reordering peers', () => {
  assert.deepEqual(teamsForView(teams, 'student', false).map(t => t.id), ['mine', 'also-mine', 'other'])
  assert.equal(teams[0].id, 'other')
})

test('my teams view includes only memberships, not all teams for admins or guests', () => {
  assert.deepEqual(teamsForView(teams, 'student', true).map(t => t.id), ['mine', 'also-mine'])
  assert.deepEqual(teamsForView(teams, 'observer', true), [])
  assert.deepEqual(teamsForView([], 'student', false), [])
})
