import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BONUS_EXTRA_TAG,
  REQUIRED_TAG,
  normalizeDeliverableTitle,
  parseDeliverablesInput,
  planDeliverableDistribution,
} from '../src/lib/deliverables'
import {
  DeliverableDistributionError,
  distributeDeliverablesInTransaction,
  type DeliverablesTransaction,
} from '../src/lib/deliverables.server'

test('validates and trims a bounded mixed deliverables list', () => {
  const parsed = parseDeliverablesInput({
    deliverables: [
      { title: '  Final report  ', description: '  Submit the report.  ', kind: 'required' },
      { title: 'Stretch demo', description: '', kind: 'bonus' },
    ],
  })

  assert.deepEqual(parsed, [
    { title: 'Final report', description: 'Submit the report.', kind: 'required' },
    { title: 'Stretch demo', description: null, kind: 'bonus' },
  ])
})

test('rejects empty, oversized, malformed, and duplicate-title input', () => {
  assert.throws(() => parseDeliverablesInput({ deliverables: [] }), /at least one/i)
  assert.throws(
    () => parseDeliverablesInput({ deliverables: [{ title: 'x'.repeat(201), kind: 'required' }] }),
    /200 characters/i
  )
  assert.throws(
    () => parseDeliverablesInput({ deliverables: [{ title: 'One', kind: 'optional' }] }),
    /required or bonus/i
  )
  assert.throws(
    () => parseDeliverablesInput({
      deliverables: [
        { title: ' Final   Report ', kind: 'required' },
        { title: 'final report', kind: 'bonus' },
      ],
    }),
    /unique/i
  )
})

test('normalizes titles for conservative idempotency matching', () => {
  assert.equal(normalizeDeliverableTitle('  FINAL\t Report  '), 'final report')
})

test('plans only missing team tickets when title and workflow tag match', () => {
  const plan = planDeliverableDistribution(
    [{ id: 'alpha' }, { id: 'beta' }],
    [
      { title: 'Final report', description: null, kind: 'required' },
      { title: 'Stretch demo', description: null, kind: 'bonus' },
    ],
    [
      { teamId: 'alpha', title: ' FINAL  REPORT ', tagName: REQUIRED_TAG },
      { teamId: 'alpha', title: 'Stretch demo', tagName: 'Student idea' },
      { teamId: 'beta', title: 'Stretch demo', tagName: BONUS_EXTRA_TAG },
    ]
  )

  assert.deepEqual(plan.create.map(({ teamId, deliverable }) => [teamId, deliverable.title]), [
    ['alpha', 'Stretch demo'],
    ['beta', 'Final report'],
  ])
  assert.equal(plan.skipped, 2)
})

test('does not treat a same-title untagged team ticket as already distributed', () => {
  const plan = planDeliverableDistribution(
    [{ id: 'alpha' }],
    [{ title: 'Final report', description: null, kind: 'required' }],
    [{ teamId: 'alpha', title: 'Final report', tagName: null }]
  )

  assert.equal(plan.create.length, 1)
  assert.equal(plan.skipped, 0)
})

test('distribution creates workflow tags and only missing tickets while preserving positions', async () => {
  const created: Array<Record<string, any>> = []
  const histories: Array<Record<string, any>> = []
  let nextTag = 0
  const tx = {
    classWorkspace: {
      findUnique: async () => ({ archivedAt: null, teams: [{ id: 'alpha' }, { id: 'beta' }] }),
    },
    tag: {
      findFirst: async ({ where }: any) => where.name === REQUIRED_TAG ? { id: 'required-tag' } : null,
      create: async ({ data }: any) => ({ id: `new-tag-${++nextTag}`, ...data }),
    },
    ticket: {
      findMany: async () => [{
        teamId: 'alpha',
        title: 'Already there',
        tags: [{ tag: { name: REQUIRED_TAG } }],
      }],
      findFirst: async ({ where }: any) => ({ position: where.teamId === 'alpha' ? 7 : 2 }),
      create: async ({ data }: any) => {
        const ticket = { id: `ticket-${created.length + 1}`, status: 'BACKLOG', ...data }
        created.push(ticket)
        return ticket
      },
    },
    ticketHistory: {
      create: async ({ data }: any) => { histories.push(data); return data },
    },
  } as unknown as DeliverablesTransaction

  const result = await distributeDeliverablesInTransaction(tx, 'class-1', 'admin-1', [
    { title: 'Already there', description: null, kind: 'required' },
    { title: 'Optional polish', description: 'Stretch work', kind: 'bonus' },
  ])

  assert.deepEqual(result, { created: 3, skipped: 1, teams: 2, deliverables: 2 })
  assert.deepEqual(created.map((ticket) => [ticket.teamId, ticket.title, ticket.position]), [
    ['alpha', 'Optional polish', 8],
    ['beta', 'Already there', 3],
    ['beta', 'Optional polish', 4],
  ])
  assert.equal(created[0].tags.create[0].tagId, 'new-tag-1')
  assert.equal(created[1].tags.create[0].tagId, 'required-tag')
  assert.equal(histories.length, 3)
})

test('distribution rejects missing and archived classes before writing', async () => {
  const tx = {
    classWorkspace: { findUnique: async () => null },
  } as unknown as DeliverablesTransaction
  await assert.rejects(
    distributeDeliverablesInTransaction(tx, 'missing', 'admin', [
      { title: 'Requirement', description: null, kind: 'required' },
    ]),
    (error: unknown) => error instanceof DeliverableDistributionError && error.status === 404
  )

  const archivedTx = {
    classWorkspace: { findUnique: async () => ({ archivedAt: new Date(), teams: [{ id: 'alpha' }] }) },
  } as unknown as DeliverablesTransaction
  await assert.rejects(
    distributeDeliverablesInTransaction(archivedTx, 'archived', 'admin', [
      { title: 'Requirement', description: null, kind: 'required' },
    ]),
    (error: unknown) => error instanceof DeliverableDistributionError && error.status === 409
  )
})
