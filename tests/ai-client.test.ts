import test from 'node:test'
import assert from 'node:assert/strict'

import { chat } from '../src/lib/ai'

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
