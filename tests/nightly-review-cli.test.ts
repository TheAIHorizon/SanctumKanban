import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('scripts/nightly-ticket-review.ts', 'utf8')

test('nightly CLI requires explicit opt-in and database URL', () => {
  assert.match(source, /NIGHTLY_REVIEW_RUNNER/)
  assert.match(source, /DATABASE_URL/)
  assert.match(source, /--once/)
  assert.match(source, /--daemon/)
  assert.match(source, /--dry-run/)
})

test('daemon uses a sixty-second non-overlapping loop and signal shutdown', () => {
  assert.match(source, /60_000/)
  assert.match(source, /SIGINT/)
  assert.match(source, /SIGTERM/)
  assert.match(source, /await runNightlyReviews/)
  assert.doesNotMatch(source, /setInterval/)
})

test('unexpected database errors are logged without their raw message', () => {
  assert.match(source, /safePrismaCode/)
  assert.match(source, /Nightly review tick failed; retrying/)
  assert.doesNotMatch(source, /retrying: \$\{message\}/)
  assert.doesNotMatch(source, /runner failed: \$\{message\}/)
})
