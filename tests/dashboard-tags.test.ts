import test from 'node:test'
import assert from 'node:assert/strict'
import { withGlobalTags } from '../src/lib/dashboard-tags'

test('dashboard team tag pickers include global workflow tags without mixing team tags', () => {
  const teams = [{ id: 'a', tags: [{ id: 'a-tag', name: 'Team A' }] }, { id: 'b', tags: [] }]
  const global = [{ id: 'bonus', name: 'Bonus / Extra' }]
  assert.deepEqual(withGlobalTags(teams, global).map(t => t.tags.map(tag => tag.id)), [['bonus', 'a-tag'], ['bonus']])
  assert.equal(teams[0].tags.length, 1)
})
