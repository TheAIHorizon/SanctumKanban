import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/lib/nightly-review-prisma.server.ts', 'utf8')

test('finish metadata is guarded by a locked live owner lease and schedule snapshot', () => {
  const finish = source.slice(source.indexOf('async finishClassRun'), source.indexOf('async failClassRun'))
  assert.match(finish, /guardLiveLease/)
  assert.match(finish, /result\.owner/)
  assert.match(finish, /nightlyReviewHour: result\.scheduleHour/)
  assert.match(finish, /nightlyReviewTimezone: result\.scheduleTimezone/)
  assert.match(finish, /nightlyReviewRequestedAt: result\.processedRequestedAt/)
})

test('failure metadata is guarded by a locked live owner lease and schedule snapshot', () => {
  const failure = source.slice(source.indexOf('async failClassRun'))
  assert.match(failure, /\$transaction/)
  assert.match(failure, /guardLiveLease/)
  assert.match(failure, /result\.owner/)
  assert.match(failure, /nightlyReviewHour: result\.scheduleHour/)
  assert.match(failure, /nightlyReviewTimezone: result\.scheduleTimezone/)
})