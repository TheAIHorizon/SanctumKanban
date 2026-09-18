import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultNightlyReviewSettings, validateNightlyReviewDraft } from '../src/lib/nightly-review-settings'

test('nightly review UI defaults are disabled at 2 AM America/Los_Angeles', () => {
  assert.deepEqual(defaultNightlyReviewSettings(), { enabled: false, hour: 2, timeZone: 'America/Los_Angeles' })
})

test('nightly review draft accepts only whole local hours and named time zones', () => {
  assert.equal(validateNightlyReviewDraft({ enabled: true, hour: 23, timeZone: 'America/New_York' }), null)
  assert.match(validateNightlyReviewDraft({ enabled: true, hour: 24, timeZone: 'UTC' }) || '', /hour/i)
  assert.match(validateNightlyReviewDraft({ enabled: true, hour: 2.5, timeZone: 'UTC' }) || '', /hour/i)
  assert.match(validateNightlyReviewDraft({ enabled: true, hour: 2, timeZone: '' }) || '', /time zone/i)
})

test('NightlyReviewSettings implements GET PATCH and queued-run contracts safely', () => {
  const source = readFileSync('src/components/admin/NightlyReviewSettings.tsx', 'utf8')
  assert.match(source, /`\/api\/classes\/\$\{classId\}\/nightly-review`/)
  assert.match(source, /method: 'PATCH'/)
  assert.match(source, /method: 'POST'/)
  assert.match(source, /`\/api\/classes\/\$\{classId\}\/nightly-review\/run`/)
  assert.match(source, /JSON\.stringify\(\{ enabled, hour, timeZone \}\)/)
  assert.match(source, /new AbortController\(\)/)
  assert.match(source, /requestGeneration\.current/)
  assert.match(source, /finally/)
  assert.match(source, /background runner/i)
  assert.match(source, /queued request/i)
  assert.doesNotMatch(source, /review complete/i)
})

test('admin class cards expose nightly settings', () => {
  const source = readFileSync('src/app/(dashboard)/admin/classes/page.tsx', 'utf8')
  assert.match(source, /<NightlyReviewSettings key=\{`nightly:/)
  assert.match(source, /classId=\{workspace\.id\}/)
  assert.match(source, /isArchived=\{isArchived\}/)
})

test('archived nightly settings are read-only and queueing requires clean persisted opt-in', () => {
  const source = readFileSync('src/components/admin/NightlyReviewSettings.tsx', 'utf8')
  assert.match(source, /isArchived: boolean/)
  assert.match(source, /disabled=\{isArchived\}/)
  assert.match(source, /!settings\.enabled/)
  assert.match(source, /dirty/)
  assert.match(source, /Archived classes are read-only/i)
})
