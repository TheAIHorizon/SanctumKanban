import test from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { runAssessmentJob } from '../src/lib/assessment-worker.server'
import { AiUnavailableError, type chat } from '../src/lib/ai'

// An in-memory job only: no database or real student evidence is used.
function fixture() {
  const updates: Record<string, any>[] = []
  const job = { id: 'synthetic-job', createdById: 'staff', studentId: 'student', classWorkspaceId: 'class', mode: 'EXAM', references: null, sources: [{ id: 'ticket', title: 'Synthetic SSH lab', description: 'Configured and tested SSH public-key authentication on an isolated lab machine.', contribution: 'Synthetic fixture', tasks: [] }] }
  const db: any = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ id: job.id }],
    user: { findUnique: async () => ({ role: 'ADMIN' }) },
    classWorkspace: { findUnique: async () => ({ archivedAt: null, members: [{ userId: job.studentId }] }) },
    assessment: {
      findUniqueOrThrow: async () => job,
      findMany: async () => [],
      updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 } },
    },
    $transaction: async (fn: (tx: any) => unknown) => fn(db),
  }
  return { db: db as PrismaClient, updates }
}

const valid: typeof chat = async messages => {
  const request = JSON.parse(messages[1].content)
  return JSON.stringify({ questions: Array.from({ length: request.questionCount }, (_, i) => ({
    stem: `For synthetic scenario ${request.batch + i}, which action verifies SSH authentication?`,
    optionA: 'Inspect the authentication log', optionB: 'Delete all log files', optionC: 'Disable authentication', optionD: 'Ignore the connection result',
    correctIndex: 0, explanation: 'The authentication log records observed login results; the other actions do not verify authentication.', kind: request.kind, sourceId: 'S1',
  })) })
}

test('a transient AI timeout retries and produces a complete, grounded, balanced exam', async () => {
  const { db, updates } = fixture()
  let calls = 0
  await runAssessmentJob(db, async (messages, options) => {
    calls++
    if (calls === 1) throw new AiUnavailableError('timed out', 'timeout')
    assert.equal(options?.requireComplete, true)
    assert.equal(options?.timeoutMs, 180_000)
    if (calls <= 4) assert.ok(JSON.parse(messages[1].content).questionCount <= 2)
    return valid(messages, options)
  })
  const saved = updates.find(u => u.status === 'READY')
  assert.ok(saved)
  assert.equal(saved.questions.length, 25)
  assert.deepEqual(['concept', 'application', 'troubleshooting'].map(kind => saved.questions.filter((q: any) => q.kind === kind).length), [5, 10, 10])
  assert.ok(saved.questions.every((q: any) => q.sourceIds[0] === 'ticket' && q.options[q.correctIndex] === 'Inspect the authentication log'))
  assert.ok(!updates.some(u => u.status === 'FAILED'))
})

test('complete root-array batches produce all 25 questions without losing the rest of each batch', async () => {
  const { db, updates } = fixture()
  await runAssessmentJob(db, async (messages, options) => JSON.stringify(JSON.parse(await valid(messages, options)).questions))
  assert.equal(updates.find(u => u.status === 'READY')?.questions.length, 25)
  assert.ok(!updates.some(u => u.status === 'FAILED'))
})

test('terminal failures save a specific reason and log metadata without evidence or provider errors', async () => {
  const originalWarn = console.warn
  const logs: string[] = []
  console.warn = message => { logs.push(String(message)) }
  try {
    for (const [failure, expected, callCount] of [
      [new AiUnavailableError('private provider secret', 'timeout'), /three-minute/, 2],
      [new AiUnavailableError('private provider secret', 'http', 401), /rejected/, 1],
      [new AiUnavailableError('private provider secret', 'truncated'), /length limit/, 2],
      ['not JSON private provider secret', /malformed/, 2],
      ['{"questions":[]}', /valid, distinct/, 2],
      ['{"questions":[null,null]}', /valid, distinct/, 2],
      ['{"insufficientEvidence":true}', /confidently/, 1],
    ] as const) {
      const { db, updates } = fixture()
      let calls = 0
      await runAssessmentJob(db, async () => { calls++; if (failure instanceof Error) throw failure; return failure })
      assert.equal(calls, callCount)
      const saved = updates.find(u => u.status === 'FAILED')
      assert.ok(saved); assert.match(saved.error, expected); assert.ok(saved.model)
      assert.equal(saved.questions, undefined)
      assert.ok(!updates.some(u => u.status === 'READY'))
      assert.ok(!JSON.stringify(updates).includes('private provider secret'))
    }
    assert.equal(logs.filter(line => JSON.parse(line).event === 'assessment_generation_failed').length, 7)
    assert.ok(logs.every(line => !line.includes('private provider secret') && !line.includes('Synthetic SSH lab')))
  } finally { console.warn = originalWarn }
})

test('cancellation fences off an otherwise valid generated exam', async () => {
  const { db, updates } = fixture()
  let canceled = false
  const originalUpdate = db.assessment.updateMany
  db.assessment.updateMany = (async (args: any) => canceled ? { count: 0 } : originalUpdate(args)) as any
  await runAssessmentJob(db, async (messages, options) => { canceled = true; return valid(messages, options) })
  assert.ok(!updates.some(u => ['READY', 'FAILED'].includes(u.status)))
})

test('a canceled job does not retry a failed AI request', async () => {
  const { db, updates } = fixture()
  let calls = 0
  await runAssessmentJob(db, async () => {
    calls++
    db.assessment.updateMany = (async () => ({ count: 0 })) as any
    throw new AiUnavailableError('timeout', 'timeout')
  })
  assert.equal(calls, 1)
  assert.ok(!updates.some(u => ['READY', 'FAILED'].includes(u.status)))
})


test('healthy generation uses five batches and the exact assessment model independently of the general fallback', async () => {
  const original = process.env.AI_ASSESSMENT_MODEL
  delete process.env.AI_ASSESSMENT_MODEL
  try {
    const { db, updates } = fixture()
    const sizes: number[] = []
    await runAssessmentJob(db, async (messages, options) => {
      sizes.push(JSON.parse(messages[1].content).questionCount)
      assert.equal(options?.model, 'nemotron-3-super')
      assert.equal(options?.temperature, 0.8)
      assert.equal(options?.maxTokens, 4000)
      assert.equal(options?.json, true)
      assert.match(messages[0].content, /Never use markdown code fences\./)
      assert.ok(messages[0].content.includes('On EVERY question set "kind":"' + JSON.parse(messages[1].content).kind + '"'))
      return valid(messages, options)
    })
    assert.deepEqual(sizes, [5, 5, 5, 5, 5])
    assert.equal(updates.find(u => u.status === 'READY')?.questions.length, 25)
  } finally {
    if (original === undefined) delete process.env.AI_ASSESSMENT_MODEL
    else process.env.AI_ASSESSMENT_MODEL = original
  }
})

test('malformed stop output is recovered in smaller batches, while trailing prose is accepted', async () => {
  const { db, updates } = fixture()
  const sizes: number[] = []
  await runAssessmentJob(db, async (messages, options) => {
    sizes.push(JSON.parse(messages[1].content).questionCount)
    if (sizes.length === 1) return '{"questions":[{"stem":"unterminated'
    if (sizes.length <= 4) {
      assert.equal(options?.temperature, 0.2)
      assert.match(messages[0].content, /This smaller batch replaces a failed response/)
    }
    return await valid(messages, options) + '\nAdditional explanation after the complete JSON.'
  })
  assert.deepEqual(sizes, [5, 2, 2, 1, 5, 5, 5, 5])
  assert.equal(updates.find(u => u.status === 'READY')?.questions.length, 25)
})

test('a later failed recovery batch cannot publish the earlier valid questions', async () => {
  const { db, updates } = fixture()
  const originalWarn = console.warn
  console.warn = () => {}
  let calls = 0
  try {
    await runAssessmentJob(db, async (messages, options) => {
      calls++
      if (calls === 1 || calls === 3) throw new AiUnavailableError('timeout', 'timeout')
      return valid(messages, options)
    })
    assert.equal(calls, 3)
    assert.ok(updates.some(u => u.status === 'FAILED'))
    assert.ok(!updates.some(u => u.questions || u.status === 'READY'))
  } finally { console.warn = originalWarn }
})
