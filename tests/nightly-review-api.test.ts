import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { parseNightlySettingsPatch } from '../src/lib/nightly-review'

test('nightly settings validation accepts partial valid values and rejects bad hour, timezone, and keys', () => {
  assert.deepEqual(parseNightlySettingsPatch({ enabled: true, hour: 2, timeZone: 'America/Los_Angeles' }), {
    nightlyReviewEnabled: true,
    nightlyReviewHour: 2,
    nightlyReviewTimezone: 'America/Los_Angeles',
  })
  assert.equal(parseNightlySettingsPatch({ hour: 24 }), null)
  assert.equal(parseNightlySettingsPatch({ hour: 2.5 }), null)
  assert.equal(parseNightlySettingsPatch({ timeZone: 'Mars/Olympus' }), null)
  assert.equal(parseNightlySettingsPatch({ unexpected: true }), null)
  assert.equal(parseNightlySettingsPatch({}), null)
})

test('settings and run-request routes are admin-only and never run inference', () => {
  const settings = readFileSync('src/app/api/classes/[id]/nightly-review/route.ts', 'utf8')
  const request = readFileSync('src/app/api/classes/[id]/nightly-review/run/route.ts', 'utf8')
  for (const source of [settings, request]) {
    assert.match(source, /role !== 'ADMIN'/)
    assert.match(source, /archivedAt/)
    assert.doesNotMatch(source, /\bchat\s*\(/)
    assert.doesNotMatch(source, /runNightlyReviews/)
  }
  assert.match(request, /nightlyReviewRequestedAt/)
  assert.match(request, /nightlyReviewEnabled:\s*true/)
})

test('guidance route is private, bounded to ten, and does not expose raw prompts', () => {
  const source = readFileSync('src/app/api/tickets/[id]/guidance/route.ts', 'utf8')
  assert.match(source, /role === 'ADMIN'/)
  assert.match(source, /role === 'OBSERVER'/)
  assert.match(source, /members/)
  assert.match(source, /take:\s*11/)
  assert.match(source, /slice\(0, 10\)/)
  assert.match(source, /hasMore/)
  assert.match(source, /isCurrent/)
  assert.doesNotMatch(source, /rawPrompt|messages|prompt:/)
})
