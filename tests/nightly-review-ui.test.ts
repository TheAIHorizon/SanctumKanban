import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRunSummary, hasPendingReview } from '../src/lib/nightly-review-ui'

test('scheduler summary JSON is rendered as text, not an invalid React child', () => {
  assert.equal(formatRunSummary({ attempted: 2, savedAi: 1 }), '{"attempted":2,"savedAi":1}')
  assert.equal(formatRunSummary(null), null)
  assert.equal(formatRunSummary('Finished'), 'Finished')
})

test('a retained request stays pending even when partial runner activity occurred later', () => {
  assert.equal(hasPendingReview({ nightlyReviewRequestedAt: '2026-09-17T08:00:00Z', nightlyReviewLastRunAt: '2026-09-17T08:01:00Z' }), true)
  assert.equal(hasPendingReview({ nightlyReviewRequestedAt: null }), false)
})
