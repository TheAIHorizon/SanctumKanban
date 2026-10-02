import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'

test('installer AI check exercises each explicit model and never prints credentials or provider error bodies', async () => {
  const requests: any[] = []
  let denied = false
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) })
    res.writeHead(denied ? 401 : 200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(denied ? { error: 'private-provider-error-sentinel' } : {
      choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}\nprovider trailer' } }],
    }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const run = () => new Promise<{ error: Error | null; output: string }>(resolve => {
    execFile(process.execPath, ['--import', 'tsx', 'scripts/ai-check.ts'], {
      env: { ...process.env, AI_BASE_URL: `http://127.0.0.1:${address.port}/v1`, AI_API_KEY: 'private-key-sentinel',
        AI_MODEL: 'general-test', AI_COACH_MODEL: 'coach-test', AI_ASSESSMENT_MODEL: 'exam-test' },
      timeout: 15000,
    }, (error, stdout, stderr) => resolve({ error, output: stdout + stderr }))
  })
  try {
    const good = await run()
    assert.equal(good.error, null, good.output)
    assert.equal((good.output.match(/PASS /g) || []).length, 3)
    assert.deepEqual(requests.map(req => req.body.model), ['general-test', 'coach-test', 'exam-test'])
    for (const req of requests) {
      assert.equal(req.url, '/v1/chat/completions')
      assert.equal(req.auth, 'Bearer private-key-sentinel')
      assert.deepEqual(req.body.response_format, { type: 'json_object' })
      assert.equal(req.body.stream, false)
      assert.equal(req.body.max_tokens, 4000)
      assert.ok(req.body.messages.every((message: any) => typeof message.content === 'string'))
    }
    denied = true
    const bad = await run()
    assert.ok(bad.error)
    assert.equal((bad.output.match(/HTTP 401/g) || []).length, 3)
    assert.doesNotMatch(good.output + bad.output, /private-key-sentinel|private-provider-error-sentinel/)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
