import test from 'node:test'
import assert from 'node:assert/strict'

import { chat, AiUnavailableError } from '../src/lib/ai'

test('AI client sends a dedicated model override and bounded output request', async () => {
  const originalFetch = globalThis.fetch
  let requestBody: Record<string, unknown> | undefined
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  try {
    await chat([{ role: 'user', content: 'bounded test' }], {
      model: 'laguna-s',
      maxTokens: 1800,
      timeoutMs: 45_000,
      json: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(requestBody?.model, 'laguna-s')
  assert.equal(requestBody?.max_tokens, 1800)
  assert.deepEqual(requestBody?.response_format, { type: 'json_object' })
})

test('AI failures distinguish timeouts, HTTP errors and truncated structured output without exposing provider data', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('private network detail')), { once: true })
    })
    await assert.rejects(chat([], { timeoutMs: 1 }), (e: unknown) => e instanceof AiUnavailableError && e.code === 'timeout' && !e.message.includes('private'))
    globalThis.fetch = async () => new Response('private provider detail', { status: 401 })
    await assert.rejects(chat([]), (e: unknown) => e instanceof AiUnavailableError && e.code === 'http' && e.status === 401 && !e.message.includes('private'))
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"questions":[' } }] }))
    await assert.rejects(chat([], { requireComplete: true }), (e: unknown) => e instanceof AiUnavailableError && e.code === 'truncated')
    // Other AI features can still consume intentionally short, unstructured responses.
    assert.equal(await chat([]), '{"questions":[')
    globalThis.fetch = async () => new Response('not JSON')
    await assert.rejects(chat([]), (e: unknown) => e instanceof AiUnavailableError && e.code === 'invalid_response')
  } finally { globalThis.fetch = originalFetch }
})


test('background inference gets a bounded longer timeout without changing interactive limits', async () => {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const deadlines: number[] = []
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }))) as typeof fetch
  globalThis.setTimeout = ((callback: any, ms: number, ...args: any[]) => { deadlines.push(ms); return originalSetTimeout(callback, ms, ...args) }) as typeof setTimeout
  try {
    await chat([], { timeoutMs: 999_999 })
    await chat([], { timeoutMs: 120_000, background: true })
    await chat([], { timeoutMs: 999_999, background: true })
    assert.deepEqual(deadlines, [45_000, 120_000, 180_000])
  } finally { globalThis.fetch = originalFetch; globalThis.setTimeout = originalSetTimeout }
})


test('stop is not a guarantee of valid question JSON', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"questions":[{"stem":"unterminated' } }] }))
    const { parseAssessmentJson } = await import('../src/lib/assessments')
    const result = await chat([], { requireComplete: true, json: true })
    assert.throws(() => parseAssessmentJson(result))
  } finally { globalThis.fetch = originalFetch }
})
