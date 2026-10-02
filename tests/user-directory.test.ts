import assert from 'node:assert/strict'
import test from 'node:test'
import { selectDirectoryUsers, directoryTeams, NO_CLASS, type DirectoryUser, type UserSortColumn } from '../src/lib/user-directory'
const a = { id: 'a', name: 'Biology', code: 'BIO', term: 'Fall', archivedAt: null }
const b = { id: 'b', name: 'Chemistry', code: null, term: 'Spring', archivedAt: '2026-06-01' }
const user = (id: string, firstName: string, lastName: string, overrides: Partial<DirectoryUser> = {}): DirectoryUser => ({ id, firstName, lastName, email: `${id}@example.invalid`, contactInfo: null, role: 'MEMBER', createdAt: '2026-01-01', classMemberships: [], teamMemberships: [], ...overrides })
const users = [
  user('1', 'Élodie', 'Zulu', { classMemberships: [{ classWorkspace: a }, { classWorkspace: b }], teamMemberships: [{ team: { id: 't1', name: 'Team 10', classWorkspaceId: 'a' } }, { team: { id: 't2', name: 'Team 2', classWorkspaceId: 'b' } }], contactInfo: '555-2', createdAt: '2026-09-01' }),
  user('2', 'Zara', 'Alpha', { classMemberships: [{ classWorkspace: a }], contactInfo: '555-10', role: 'ADMIN', createdAt: '2026-02-01' }),
  user('3', 'Amir', 'Beta'),
]
const select = (options: Partial<Parameters<typeof selectDirectoryUsers>[1]> = {}) => selectDirectoryUsers(users, { classId: '', search: '', column: 'name', direction: 'asc', ...options }).map(u => u.id)
test('class enrollment includes users without teams and avoids duplicate multi-class users', () => {
  assert.deepEqual(select({ classId: 'a' }), ['2', '1'])
  assert.deepEqual(select({ classId: 'b' }), ['1'])
  assert.deepEqual(select({ classId: NO_CLASS }), ['3'])
  assert.deepEqual(select({ classId: 'missing' }), [])
  assert.deepEqual(directoryTeams(users[0], 'a').map(m => m.team.id), ['t1'])
  assert.equal(directoryTeams(users[1], 'a').length, 0)
})
test('name/email search is case/accent insensitive, order independent and combined with class selection', () => {
  assert.deepEqual(select({ search: ' ZULU, elodie ' }), ['1'])
  assert.deepEqual(select({ search: 'ami' }), ['3'])
  assert.deepEqual(select({ search: '2@EXAMPLE' }), ['2'])
  assert.deepEqual(select({ classId: 'b', search: 'zara' }), [])
})
test('all data columns sort in both directions; missing values remain last and input is untouched', () => {
  const expected: Record<UserSortColumn, [string[], string[]]> = {
    name: [['2', '3', '1'], ['1', '3', '2']], email: [['1', '2', '3'], ['3', '2', '1']],
    contact: [['1', '2', '3'], ['2', '1', '3']], role: [['2', '3', '1'], ['3', '1', '2']],
    classes: [['2', '1', '3'], ['1', '2', '3']], teams: [['1', '2', '3'], ['1', '2', '3']],
    joined: [['3', '2', '1'], ['1', '2', '3']],
  }
  const before = JSON.stringify(users)
  for (const column of Object.keys(expected) as UserSortColumn[]) {
    assert.deepEqual(select({ column }), expected[column][0], column + ' ascending')
    assert.deepEqual(select({ column, direction: 'desc' }), expected[column][1], column + ' descending')
  }
  assert.equal(JSON.stringify(users), before)
})
