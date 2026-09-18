import test from 'node:test'
import assert from 'node:assert/strict'
import { sortFeedbackChronologically } from '../src/lib/team-feedback'

test('pinned instructor guidance stays above the chronological unpinned feed', () => {
  const posts = [
    { id: 'older', createdAt: '2026-09-16T00:00:00Z', pinned: false, replies: [] },
    { id: 'pinned', createdAt: '2026-09-17T00:00:00Z', pinned: true, replies: [] },
  ]
  assert.deepEqual(sortFeedbackChronologically(posts).map(p => p.id), ['pinned', 'older'])
  assert.equal(posts[0].id, 'older')
})
