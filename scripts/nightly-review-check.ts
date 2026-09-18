import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { loadEnvConfig } from '@next/env'

const supplied = process.env.DATABASE_URL
assert.ok(supplied, 'Explicit local DATABASE_URL required')
const url = new URL(supplied)
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55439'); assert.equal(url.pathname, '/sanctum_ga_check')
loadEnvConfig(process.cwd(), false, { info() {}, error() {} })

async function main() {
  const { default: prisma } = await import('../src/lib/prisma')
  const { chat } = await import('../src/lib/ai')
  assert.equal(typeof chat, 'function', 'QA harness must resolve the real chat export before running fixtures')
  const { runNightlyReviews } = await import('../src/lib/nightly-review.server')
  const { createPrismaNightlyReviewRepository } = await import('../src/lib/nightly-review-prisma.server')
  const owner = 'nightly-qa-' + randomUUID()
  let classId: string | undefined
  let userId: string | undefined
  let count = 0
  const pass = (name: string) => { count++; console.log('PASS ' + name) }
  try {
    const user = await prisma.user.create({ data: { email: `${owner}@example.invalid`, firstName: 'Nightly', lastName: 'Synthetic QA', role: 'ADMIN', passwordHash: 'unusable-test-account' } })
    userId = user.id
    const workspace = await prisma.classWorkspace.create({ data: { name: owner, createdById: user.id, nightlyReviewEnabled: true, nightlyReviewRequestedAt: new Date() } })
    classId = workspace.id
    const team = await prisma.team.create({ data: { name: 'Nightly QA team', classWorkspaceId: classId } })
    const ticket = await prisma.ticket.create({ data: { title: 'Synthetic Ubuntu installation', description: 'Installed Ubuntu Server.', teamId: team.id, createdById: user.id } })
    const before = JSON.stringify(ticket)
    const baseRepository = createPrismaNightlyReviewRepository()
    const repository = { ...baseRepository, listClasses: async () => (await baseRepository.listClasses()).filter(c => c.id === classId) }
    const queue = () => prisma.classWorkspace.update({ where: { id: classId! }, data: { nightlyReviewEnabled: true, nightlyReviewRequestedAt: new Date() } })
    const dry = await runNightlyReviews({ repository, owner, chat: async () => { throw new Error('Dry run must not call model') }, dryRun: true })
    assert.equal(dry.summary.attempted, 1)
    assert.equal(await prisma.ticketAiGuidance.count({ where: { ticketId: ticket.id } }), 0)
    assert.equal(await prisma.nightlyReviewLease.count(), 0)
    pass('dry-run is read-only and does not send ticket content to the model')
    const leaseNow = new Date()
    const leaseExpiry = new Date(leaseNow.getTime() + 120000)
    assert.equal(await repository.acquireLease(owner, leaseNow, leaseExpiry), true)
    assert.equal((await prisma.nightlyReviewLease.findUniqueOrThrow({ where: { id: 'global' } })).expiresAt.toISOString(), leaseExpiry.toISOString())
    assert.equal(await repository.heartbeatLease(owner, new Date(), leaseExpiry), true)
    await repository.releaseLease(owner)
    pass('lease timestamps remain UTC-correct on the configured PostgreSQL timezone')
    const observedChat: typeof chat = async (messages, options) => {
      const started = Date.now()
      try {
        const raw = await chat(messages, options)
        const { parseGroundedAdvice } = await import('../src/lib/dcwf-suggest')
        const context = JSON.parse(messages[1].content)
        const candidates = context.eligibleTasks.map((task: any) => ({ ...task, workRoles: [] }))
        if (!parseGroundedAdvice(context.ticketText, candidates, raw)) console.log('Synthetic model output did not validate; checking fallback and retry behavior.')
        return raw
      } catch (error) {
        const message = error instanceof Error && /^AI endpoint returned \d+$/.test(error.message) ? error.message : 'Network or timeout failure'
        console.log('Synthetic model diagnostic:', message, 'elapsedMs:', Date.now() - started)
        throw error
      }
    }
    let first = await runNightlyReviews({ repository, owner, chat: observedChat, batchSize: 1 })
    if (first.summary.savedAi === 0) {
      const fallback = await prisma.ticketAiGuidance.findFirst({ where: { ticketId: ticket.id } })
      if (fallback?.nextRetryAt) {
        // Simulate the documented next retry becoming due, on this fixture only.
        await prisma.ticketAiGuidance.update({ where: { id: fallback.id }, data: { nextRetryAt: new Date(0) } })
        await queue()
        first = await runNightlyReviews({ repository, owner, chat: observedChat, batchSize: 1 })
      }
    }
    assert.equal(first.acquired, true)
    if (first.summary.savedAi !== 1) console.log('Nightly diagnostics:', first.summary, await prisma.ticketAiGuidance.findMany({ where: { ticketId: ticket.id }, select: { mode: true, model: true, candidateCount: true } }))
    assert.equal(first.summary.savedAi, 1, 'A real Laguna S saved review is required')
    const reviews = await prisma.ticketAiGuidance.findMany({ where: { ticketId: ticket.id } })
    assert.equal(reviews.length, 1); assert.equal(reviews[0].model, 'laguna-s'); assert.equal(reviews[0].mode, 'ai')
    assert.equal(JSON.stringify(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })), before)
    assert.equal(await prisma.ticketDcwfTask.count({ where: { ticketId: ticket.id } }), 0)
    pass('real nightly Laguna S guidance is stored without changing ticket content, status, or links')
    await queue()
    const second = await runNightlyReviews({ repository, owner, chat: async () => { throw new Error('Unchanged review must not call model') } })
    assert.equal(second.summary.attempted, 0); assert.equal(second.summary.skippedUnchanged, 1)
    assert.equal(await prisma.ticketAiGuidance.count({ where: { ticketId: ticket.id } }), 1)
    pass('unchanged tickets are not reprocessed or given duplicate guidance')
    const cliTicket = await prisma.ticket.create({ data: { title: 'zzzzzz qqqqqq', teamId: team.id, createdById: user.id } })
    await queue()
    assert.equal(await prisma.classWorkspace.count({ where: { nightlyReviewEnabled: true, archivedAt: null, id: { not: classId } } }), 0, 'CLI test refuses to review unrelated enabled classes')
    const cli = spawnSync(resolve('node_modules/.bin/tsx'), ['scripts/nightly-ticket-review.ts', '--once'], { cwd: process.cwd(), env: { ...process.env, NIGHTLY_REVIEW_RUNNER: '1' }, encoding: 'utf8', timeout: 120000 })
    assert.equal(cli.status, 0, 'Real runner command must complete')
    assert.equal((await prisma.ticketAiGuidance.findFirstOrThrow({ where: { ticketId: cliTicket.id } })).mode, 'fallback:no_candidates')
    pass('real CLI processes a queued local class and saves honestly labeled fallback')
    const stale = await prisma.ticket.create({ data: { title: 'Configure a firewall', description: 'Synthetic race fixture', teamId: team.id, createdById: user.id } })
    await queue()
    const race = await runNightlyReviews({ repository, owner, chat: async () => {
      await prisma.ticket.update({ where: { id: stale.id }, data: { description: 'Changed while inference was running' } })
      return JSON.stringify({ guidance: { summary: 'Synthetic stale model result', feedback: [], abstained: true }, tasks: [] })
    } })
    assert.equal(race.summary.stale, 1)
    assert.equal(await prisma.ticketAiGuidance.count({ where: { ticketId: stale.id } }), 0)
    pass('simulated mid-inference draft change prevents saving stale guidance')
    await prisma.nightlyReviewLease.create({ data: { id: 'global', owner: owner + '-held', expiresAt: new Date(Date.now() + 60000) } })
    const blocked = await runNightlyReviews({ repository, owner: owner + '-second', chat: async () => { throw new Error('Second worker must not infer') } })
    assert.equal(blocked.acquired, false)
    await prisma.nightlyReviewLease.deleteMany({ where: { id: 'global', owner: owner + '-held' } })
    pass('a second worker cannot overlap the global review lease')
    await prisma.classWorkspace.update({ where: { id: classId }, data: { archivedAt: new Date() } })
    const archived = await runNightlyReviews({ repository, owner, chat: async () => { throw new Error('Archived class must not infer') } })
    assert.equal(archived.summary.attempted, 0)
    pass('archived classes are skipped')
    console.log('PASS total ' + count)
  } finally {
    await prisma.nightlyReviewLease.deleteMany({ where: { owner: { startsWith: owner } } })
    if (classId) await prisma.classWorkspace.deleteMany({ where: { id: classId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error('Nightly QA failed:', e instanceof Error ? e.message : 'unknown'); process.exitCode = 1 })
