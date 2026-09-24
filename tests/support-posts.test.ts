import test from 'node:test'
import assert from 'node:assert/strict'
import { createSupportPost, updateSupportPost, canUseSupport, supportWhere } from '../src/lib/support-posts'

test('reports require bounded text and reject attempts to set author or status', () => {
  const data = { kind: 'BUG', title: '  Board display  ', description: 'The chart does not display after switching views.' }
  assert.equal(createSupportPost.parse(data).title, 'Board display')
  for (const value of [{ ...data, authorId: 'someone' }, { ...data, status: 'RESOLVED' }, { ...data, title: ' ' }, { ...data, description: 'x'.repeat(10001) }, { ...data, kind: 'OTHER' }]) assert.equal(createSupportPost.safeParse(value).success, false)
})
test('only staff can see all submissions; observers and unknown roles cannot use support', () => {
  assert.deepEqual(supportWhere({ id: 'student', role: 'MEMBER' }), { authorId: 'student' })
  assert.deepEqual(supportWhere({ id: 'lead', role: 'TEAM_LEAD' }), { authorId: 'lead' })
  assert.deepEqual(supportWhere({ id: 'staff', role: 'ADMIN' }), {})
  assert.equal(canUseSupport('OBSERVER'), false); assert.equal(canUseSupport('unknown'), false)
})
test('staff changes require a valid status, bounded reply and optimistic version', () => {
  const data = { status: 'IN_PROGRESS', staffReply: 'Investigating.', updatedAt: new Date().toISOString() }
  assert.equal(updateSupportPost.safeParse(data).success, true)
  for (const value of [{ ...data, status: 'BAD' }, { ...data, updatedAt: '' }, { ...data, title: 'alter original' }, { ...data, staffReply: 'x'.repeat(10001) }]) assert.equal(updateSupportPost.safeParse(value).success, false)
})
