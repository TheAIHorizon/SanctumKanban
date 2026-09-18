import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_NIGHTLY_BATCH_SIZE,
  NIGHTLY_PROMPT_VERSION,
  computeNightlyInputHash,
  isNightlyReviewDue,
  localScheduleDate,
  normalizeBatchSize,
  validateTimeZone,
} from '../src/lib/nightly-review'
import {
  runNightlyReviews,
  type NightlyReviewRepository,
  type ReviewClass,
  type ReviewTicket,
} from '../src/lib/nightly-review.server'

const baseClass: ReviewClass = {
  id: 'class-1',
  archivedAt: null,
  nightlyReviewEnabled: true,
  nightlyReviewHour: 2,
  nightlyReviewTimezone: 'America/Los_Angeles',
  nightlyReviewRequestedAt: null,
  nightlyReviewLastRunAt: null,
  nightlyReviewLastRunDate: null,
}

const ticket = (id: string): ReviewTicket => ({
  id,
  title: `Ticket ${id}`,
  description: 'Configured DNS and tested name resolution.',
  teamId: 'team-1',
  classWorkspaceId: 'class-1',
  archived: false,
  reviews: [],
})

test('nightly input hash is stable and changes with model, prompt, title, or description', () => {
  const input = { title: ' DNS work ', description: 'tested it', model: 'laguna-s', promptVersion: NIGHTLY_PROMPT_VERSION }
  const hash = computeNightlyInputHash(input)
  assert.equal(hash, computeNightlyInputHash(input))
  assert.notEqual(hash, computeNightlyInputHash({ ...input, title: 'DNS work!' }))
  assert.notEqual(hash, computeNightlyInputHash({ ...input, description: 'different' }))
  assert.notEqual(hash, computeNightlyInputHash({ ...input, model: 'other' }))
  assert.notEqual(hash, computeNightlyInputHash({ ...input, promptVersion: 'next' }))
})

test('schedule catches up after a skipped DST hour and runs only once per local day', () => {
  const afterSpringForward = new Date('2026-03-08T10:30:00.000Z') // 03:30 in Los Angeles; 02:00 did not exist
  assert.equal(localScheduleDate(afterSpringForward, 'America/Los_Angeles'), '2026-03-08')
  assert.equal(isNightlyReviewDue(baseClass, afterSpringForward), true)
  assert.equal(isNightlyReviewDue({ ...baseClass, nightlyReviewLastRunDate: '2026-03-08' }, afterSpringForward), false)
})

test('an explicit request is due after the prior run even before the scheduled hour', () => {
  const now = new Date('2026-06-01T07:00:00.000Z') // midnight in Los Angeles
  assert.equal(isNightlyReviewDue({
    ...baseClass,
    nightlyReviewLastRunDate: '2026-06-01',
    nightlyReviewLastRunAt: new Date('2026-06-01T06:00:00.000Z'),
    nightlyReviewRequestedAt: new Date('2026-06-01T06:30:00.000Z'),
  }, now), true)
})

test('timezone and batch validation reject invalid values and enforce the maximum', () => {
  assert.equal(validateTimeZone('America/Los_Angeles'), true)
  assert.equal(validateTimeZone('Not/A_Zone'), false)
  assert.equal(normalizeBatchSize(undefined), DEFAULT_NIGHTLY_BATCH_SIZE)
  assert.equal(normalizeBatchSize(500), DEFAULT_NIGHTLY_BATCH_SIZE)
  assert.equal(normalizeBatchSize(1), 1)
})

function fakeRepository(overrides: Partial<NightlyReviewRepository> = {}) {
  const state = {
    persisted: [] as Array<{ ticketId: string; inputHash: string; mode: string }>,
    finished: [] as Array<Parameters<NightlyReviewRepository['finishClassRun']>[0]>,
    failed: [] as Array<Parameters<NightlyReviewRepository['failClassRun']>[0]>,
    released: 0,
    heartbeats: 0,
  }
  const repository: NightlyReviewRepository = {
    acquireLease: async () => true,
    heartbeatLease: async () => { state.heartbeats += 1; return true },
    ownsLease: async () => true,
    releaseLease: async () => { state.released += 1 },
    listClasses: async () => [baseClass],
    listTickets: async () => [ticket('one')],
    reloadTicket: async (id) => ticket(id),
    loadCandidates: async () => [{ id: 'dcwf-1', ksatId: '1001', description: 'Configure DNS services.', workRoles: [] }],
    saveReview: async (review) => { state.persisted.push({ ticketId: review.ticketId, inputHash: review.inputHash, mode: review.mode }); return true },
    finishClassRun: async (result) => { state.finished.push(result); return true },
    failClassRun: async (result) => { state.failed.push(result); return true },
    ...overrides,
  }
  return { repository, state }
}

const validAi = JSON.stringify({
  guidance: { summary: 'Add the observed lookup result.', feedback: [], abstained: false },
  tasks: [{ id: 'dcwf-1', rationale: 'The ticket documents DNS configuration.' }],
})

test('runner refuses overlap when the global lease is held', async () => {
  const { repository, state } = fakeRepository({ acquireLease: async () => false })
  let calls = 0
  const result = await runNightlyReviews({ repository, now: new Date('2026-06-01T12:00:00Z'), owner: 'runner-a', chat: async () => { calls += 1; return validAi } })
  assert.equal(result.acquired, false)
  assert.equal(calls, 0)
  assert.equal(state.released, 0)
})

test('runner calls inference serially, bounds attempts, and leaves backlog for the next tick', async () => {
  const tickets = [ticket('one'), ticket('two'), ticket('three')]
  const { repository, state } = fakeRepository({ listTickets: async () => tickets })
  let active = 0
  let maxActive = 0
  const result = await runNightlyReviews({
    repository,
    now: new Date('2026-06-01T12:00:00Z'),
    owner: 'runner-a',
    batchSize: 2,
    chat: async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      return validAi
    },
  })
  assert.equal(maxActive, 1)
  assert.equal(result.summary.attempted, 2)
  assert.equal(state.persisted.length, 2)
  assert.equal(state.finished[0]?.classId, 'class-1')
  assert.equal(state.finished[0]?.complete, false)
  assert.equal(state.released, 1)
})

test('runner reloads before inference and keeps stale work pending', async () => {
  const stale = { ...ticket('one'), description: 'changed before inference' }
  const { repository, state } = fakeRepository({ reloadTicket: async () => stale })
  let calls = 0
  const result = await runNightlyReviews({ repository, now: new Date('2026-06-01T12:00:00Z'), owner: 'runner-a', chat: async () => { calls += 1; return validAi } })
  assert.equal(calls, 0)
  assert.equal(result.summary.stale, 1)
  assert.equal(result.summary.remaining, 1)
  assert.equal(state.persisted.length, 0)
  assert.equal(state.finished[0]?.classId, 'class-1')
  assert.equal(state.finished[0]?.complete, false)
})

test('dry run only inspects and counts without lease, model, or persistence', async () => {
  let leases = 0
  let calls = 0
  const { repository, state } = fakeRepository({ acquireLease: async () => { leases += 1; return true } })
  const result = await runNightlyReviews({
    repository,
    now: new Date('2026-06-01T12:00:00Z'),
    owner: 'dry-run',
    dryRun: true,
    chat: async () => { calls += 1; return validAi },
  })
  assert.equal(result.acquired, true)
  assert.equal(result.summary.attempted, 1)
  assert.equal(leases, 0)
  assert.equal(calls, 0)
  assert.equal(state.persisted.length, 0)
  assert.equal(state.finished.length, 0)
})

test('a failed guarded save is stale and leaves the class incomplete', async () => {
  const { repository, state } = fakeRepository({ saveReview: async () => false })
  const result = await runNightlyReviews({ repository, now: new Date('2026-06-01T12:00:00Z'), owner: 'runner-a', chat: async () => validAi })
  assert.equal(result.summary.stale, 1)
  assert.equal(result.summary.remaining, 1)
  assert.equal(state.finished[0]?.classId, 'class-1')
  assert.equal(state.finished[0]?.complete, false)
})

test('request failures upsert a clearly labelled fallback row with a 24 hour retry', async () => {
  const { repository, state } = fakeRepository()
  const now = new Date('2026-06-01T12:00:00Z')
  let saved: Parameters<NightlyReviewRepository['saveReview']>[0] | undefined
  repository.saveReview = async (review) => { saved = review; state.persisted.push({ ticketId: review.ticketId, inputHash: review.inputHash, mode: review.mode }); return true }
  await runNightlyReviews({ repository, now, owner: 'runner-a', chat: async () => { throw new Error('offline') } })
  assert.equal(saved?.mode, 'fallback:request_failed')
  assert.equal(saved?.nextRetryAt?.toISOString(), '2026-06-02T12:00:00.000Z')
  assert.match((saved?.guidance as { summary: string }).summary, /Fallback/i)
})

test('each class stores a class-local summary while the returned summary remains aggregate', async () => {
  const secondClass = { ...baseClass, id: 'class-2' }
  const ticketsByClass: Record<string, ReviewTicket[]> = {
    'class-1': [ticket('one')],
    'class-2': [{ ...ticket('two'), teamId: 'team-2', classWorkspaceId: 'class-2' }],
  }
  const { repository, state } = fakeRepository({
    listClasses: async () => [baseClass, secondClass],
    listTickets: async (classId) => ticketsByClass[classId],
    reloadTicket: async (id, classId) => ticketsByClass[classId].find((item) => item.id === id) || null,
  })

  const result = await runNightlyReviews({
    repository,
    now: new Date('2026-06-01T12:00:00Z'),
    owner: 'runner-a',
    chat: async () => validAi,
  })

  assert.equal(result.summary.classes, 2)
  assert.equal(result.summary.attempted, 2)
  assert.deepEqual(state.finished.map(({ classId, summary }) => ({ classId, classes: summary.classes, attempted: summary.attempted })), [
    { classId: 'class-1', classes: 1, attempted: 1 },
    { classId: 'class-2', classes: 1, attempted: 1 },
  ])
})

test('finish and failure metadata carry lease owner and schedule snapshot', async () => {
  const now = new Date('2026-06-01T12:00:00Z')
  const successful = fakeRepository()
  await runNightlyReviews({ repository: successful.repository, now, owner: 'runner-a', chat: async () => validAi })
  assert.equal(successful.state.finished[0]?.owner, 'runner-a')
  assert.equal(successful.state.finished[0]?.scheduleHour, baseClass.nightlyReviewHour)
  assert.equal(successful.state.finished[0]?.scheduleTimezone, baseClass.nightlyReviewTimezone)

  const failed = fakeRepository({ loadCandidates: async () => { throw new Error('candidate load failed') } })
  await assert.rejects(runNightlyReviews({ repository: failed.repository, now, owner: 'runner-a', chat: async () => validAi }))
  assert.equal(failed.state.failed[0]?.owner, 'runner-a')
  assert.equal(failed.state.failed[0]?.classId, baseClass.id)
  assert.equal(failed.state.failed[0]?.scheduleHour, baseClass.nightlyReviewHour)
  assert.equal(failed.state.failed[0]?.scheduleTimezone, baseClass.nightlyReviewTimezone)
})

test('a lease-stale finish is rejected and cannot be reported as complete', async () => {
  let failCalls = 0
  const { repository } = fakeRepository({
    finishClassRun: async () => false,
    failClassRun: async () => { failCalls += 1; return false },
  })

  await assert.rejects(
    runNightlyReviews({ repository, now: new Date('2026-06-01T12:00:00Z'), owner: 'stale-owner', chat: async () => validAi }),
    /lease was lost/,
  )
  assert.equal(failCalls, 1)
})

test('a lease-stale failure write preserves the original runner error', async () => {
  const original = new Error('candidate load failed')
  const { repository } = fakeRepository({
    loadCandidates: async () => { throw original },
    failClassRun: async () => false,
  })

  await assert.rejects(
    runNightlyReviews({ repository, now: new Date('2026-06-01T12:00:00Z'), owner: 'stale-owner', chat: async () => validAi }),
    (error) => error === original,
  )
})
