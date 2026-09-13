import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { HELP, parseArgs, runCommandChecks, runHttpChecks, runSystemCheck } from '../scripts/system-check.mjs'

test('parseArgs defaults to a local report and disables HTTP checks', () => {
  assert.deepEqual(parseArgs([]), {
    output: '/tmp/sanctum-kanban-system-check.json',
    url: undefined,
    help: false,
  })
})

test('parseArgs accepts explicit output, HTTP URL, and help options', () => {
  assert.deepEqual(parseArgs(['--output', '/tmp/custom.json', '--url', 'http://127.0.0.1:3456']), {
    output: '/tmp/custom.json',
    url: 'http://127.0.0.1:3456',
    help: false,
  })
  assert.equal(parseArgs(['--help']).help, true)
})

test('parseArgs rejects missing values, unknown options, and non-HTTP URLs', () => {
  assert.throws(() => parseArgs(['--output']), /requires a value/)
  assert.throws(() => parseArgs(['--url', 'file:\/\/\/tmp\/app']), /http: or https:/)
  assert.throws(() => parseArgs(['--unexpected']), /Unknown option/)
})

test('parseArgs enables the opt-in database check without changing defaults', () => {
  assert.equal((parseArgs(['--database']) as { database?: boolean }).database, true)
  assert.equal(Object.hasOwn(parseArgs([]), 'database'), false)
})

test('help documents the database check and warns that build shares .next', () => {
  assert.match(HELP, /--database/)
  assert.match(HELP, /\.next/)
  assert.match(HELP, /stop.*app|copy.*first/i)
})

test('runCommandChecks runs test, lint, and build sequentially and records output', async () => {
  const calls: string[][] = []
  let active = false
  const results = await runCommandChecks(async (command: string, args: string[]) => {
    assert.equal(active, false, 'checks must not overlap')
    active = true
    calls.push([command, ...args])
    await new Promise((resolve) => setTimeout(resolve, 1))
    active = false
    return { exitCode: 0, signal: null, stdout: `${args.join(' ')} ok`, stderr: '' }
  })

  assert.deepEqual(calls, [
    ['npm', 'test'],
    ['npm', 'run', 'lint'],
    ['npm', 'run', 'build'],
  ])
  assert.deepEqual(results.map(({ name, status, exitCode }) => ({ name, status, exitCode })), [
    { name: 'test', status: 'passed', exitCode: 0 },
    { name: 'lint', status: 'passed', exitCode: 0 },
    { name: 'build', status: 'passed', exitCode: 0 },
  ])
  assert.equal(results[1].stdout, 'run lint ok')
})

test('runCommandChecks continues after failures and does not treat lint warnings as failures', async () => {
  let call = 0
  const results = await runCommandChecks(async () => {
    call += 1
    if (call === 1) return { exitCode: 2, signal: null, stdout: '', stderr: 'tests failed' }
    if (call === 2) return { exitCode: 0, signal: null, stdout: 'warning: lint warning', stderr: '' }
    return { exitCode: 0, signal: null, stdout: 'build ok', stderr: '' }
  })

  assert.equal(call, 3)
  assert.deepEqual(results.map((result) => result.status), ['failed', 'passed', 'passed'])
  assert.equal(results[0].exitCode, 2)
  assert.match(results[1].stdout, /warning/)
})

test('runHttpChecks sends unauthenticated requests and checks the required statuses', async (t) => {
  const seen: Array<{ path: string | undefined; authorization: string | undefined }> = []
  const statuses: Record<string, number> = {
    '/login': 200,
    '/api/auth/providers': 200,
    '/api/tickets': 401,
  }
  const server = createServer((request, response) => {
    seen.push({ path: request.url, authorization: request.headers.authorization })
    response.writeHead(statuses[request.url ?? ''] ?? 404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  const results = await runHttpChecks(`http://127.0.0.1:${address.port}`)

  assert.deepEqual(results.map(({ path, expectedStatus, actualStatus, status }) => ({
    path,
    expectedStatus,
    actualStatus,
    status,
  })), [
    { path: '/login', expectedStatus: 200, actualStatus: 200, status: 'passed' },
    { path: '/api/auth/providers', expectedStatus: 200, actualStatus: 200, status: 'passed' },
    { path: '/api/tickets', expectedStatus: 401, actualStatus: 401, status: 'passed' },
  ])
  assert.deepEqual(seen, [
    { path: '/login', authorization: undefined },
    { path: '/api/auth/providers', authorization: undefined },
    { path: '/api/tickets', authorization: undefined },
  ])
})

test('runSystemCheck writes a timestamped report, skips HTTP by default, and fails on a failed check', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanctum-system-check-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = join(directory, 'nested', 'report.json')
  let calls = 0

  const result = await runSystemCheck(
    { output, url: undefined, help: false },
    {
      now: () => new Date('2026-09-12T19:20:21.000Z'),
      commandRunner: async () => {
        calls += 1
        return {
          exitCode: calls === 2 ? 1 : 0,
          signal: null,
          stdout: '',
          stderr: calls === 2 ? 'lint failed' : '',
        }
      },
      fetchImpl: async () => {
        throw new Error('HTTP must not run without --url')
      },
    },
  )
  const report = JSON.parse(await readFile(output, 'utf8'))

  assert.equal(result.exitCode, 1)
  assert.equal(result.report.passed, false)
  assert.equal(report.startedAt, '2026-09-12T19:20:21.000Z')
  assert.equal(report.finishedAt, '2026-09-12T19:20:21.000Z')
  assert.equal(report.passed, false)
  assert.deepEqual(report.commandChecks.map((check: { status: string }) => check.status), [
    'passed',
    'failed',
    'passed',
  ])
  assert.deepEqual(report.httpChecks, [])
})

test('runSystemCheck runs database-check.mjs only when requested and aggregates failure', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanctum-system-check-db-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const calls: string[][] = []

  const result = await runSystemCheck(
    { output: join(directory, 'report.json'), url: undefined, help: false, database: true },
    {
      commandRunner: async (command: string, args: string[]) => {
        calls.push([command, ...args])
        const database = args.includes('scripts/database-check.mjs')
        return {
          exitCode: database ? 1 : 0,
          signal: null,
          stdout: database ? '' : 'ok',
          stderr: database ? 'Database is unreachable.\n' : '',
        }
      },
    },
  )

  assert.deepEqual(calls.at(-1), [process.execPath, 'scripts/database-check.mjs'])
  assert.equal(result.exitCode, 1)
  assert.equal(result.report.passed, false)
  assert.deepEqual((result.report as typeof result.report & { databaseCheck: unknown }).databaseCheck, {
    status: 'failed',
    exitCode: 1,
    signal: null,
    stdout: '',
    stderr: 'Database is unreachable.\n',
  })
})
