#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_OUTPUT = '/tmp/sanctum-kanban-system-check.json'

export function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    url: undefined,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]
    if (option === '--help' || option === '-h') {
      options.help = true
      continue
    }
    if (option === '--database') {
      options.database = true
      continue
    }
    if (option !== '--output' && option !== '--url') {
      throw new Error(`Unknown option: ${option}`)
    }

    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${option} requires a value`)
    }
    index += 1

    if (option === '--output') {
      options.output = value
      continue
    }

    let parsedUrl
    try {
      parsedUrl = new URL(value)
    } catch {
      throw new Error('--url must be a valid http: or https: URL')
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('--url must use http: or https:')
    }
    options.url = value
  }

  return options
}

export function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on('error', (error) => {
      resolve({ exitCode: null, signal: null, stdout, stderr: `${stderr}${error.message}\n` })
    })
    child.on('close', (exitCode, signal) => {
      resolve({ exitCode, signal, stdout, stderr })
    })
  })
}

const COMMAND_CHECKS = [
  { name: 'test', command: 'npm', args: ['test'] },
  { name: 'lint', command: 'npm', args: ['run', 'lint'] },
  { name: 'build', command: 'npm', args: ['run', 'build'] },
]

export async function runCommandChecks(commandRunner = runCommand) {
  const results = []
  for (const check of COMMAND_CHECKS) {
    const started = performance.now()
    const result = await commandRunner(check.command, check.args)
    results.push({
      ...check,
      status: result.exitCode === 0 ? 'passed' : 'failed',
      exitCode: result.exitCode,
      signal: result.signal ?? null,
      durationMs: Math.round(performance.now() - started),
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    })
  }
  return results
}

export async function runDatabaseCheck(commandRunner = runCommand) {
  const result = await commandRunner(process.execPath, ['scripts/database-check.mjs'])
  return {
    status: result.exitCode === 0 ? 'passed' : 'failed',
    exitCode: result.exitCode,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const HTTP_CHECKS = [
  { path: '/login', expectedStatus: 200 },
  { path: '/api/auth/providers', expectedStatus: 200 },
  { path: '/api/tickets', expectedStatus: 401 },
]

export async function runHttpChecks(baseUrl, fetchImpl = fetch) {
  const results = []
  for (const check of HTTP_CHECKS) {
    const started = performance.now()
    const url = new URL(check.path, baseUrl).href
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
      results.push({
        ...check,
        url,
        status: response.status === check.expectedStatus ? 'passed' : 'failed',
        actualStatus: response.status,
        durationMs: Math.round(performance.now() - started),
        error: null,
      })
    } catch (error) {
      results.push({
        ...check,
        url,
        status: 'failed',
        actualStatus: null,
        durationMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}

export async function runSystemCheck(options, dependencies = {}) {
  const now = dependencies.now ?? (() => new Date())
  const startedAt = now()
  const commandChecks = await runCommandChecks(dependencies.commandRunner ?? runCommand)
  const httpChecks = options.url
    ? await runHttpChecks(options.url, dependencies.fetchImpl ?? fetch)
    : []
  const databaseCheck = options.database
    ? await runDatabaseCheck(dependencies.commandRunner ?? runCommand)
    : undefined
  const finishedAt = now()
  const passed = [...commandChecks, ...httpChecks].every((check) => check.status === 'passed')
    && (!databaseCheck || databaseCheck.status === 'passed')
  const report = {
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    passed,
    url: options.url ?? null,
    commandChecks,
    httpChecks,
    ...(databaseCheck ? { databaseCheck } : {}),
  }

  await mkdir(dirname(options.output), { recursive: true })
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { exitCode: passed ? 0 : 1, report }
}

export const HELP = `Usage: node scripts/system-check.mjs [options]

Runs npm test, npm run lint, and npm run build sequentially.
Warning: build shares the .next directory with a running app; stop the app or copy the project first.

Options:
  --output PATH  JSON report path (default: ${DEFAULT_OUTPUT})
  --url URL      Also check /login (200), /api/auth/providers (200),
                 and unauthenticated /api/tickets (401)
  --database     Also verify real database connectivity and required schema (read-only)
  --help, -h     Show this help
`

export async function main(argv = process.argv.slice(2)) {
  let options
  try {
    options = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`System check: ${error instanceof Error ? error.message : String(error)}\n`)
    process.stderr.write('Run node scripts/system-check.mjs --help for usage.\n')
    return 1
  }

  if (options.help) {
    process.stdout.write(HELP)
    return 0
  }

  try {
    const result = await runSystemCheck(options)
    process.stdout.write(`System-check report: ${options.output}\n`)
    process.stdout.write(`Overall result: ${result.report.passed ? 'PASSED' : 'FAILED'}\n`)
    return result.exitCode
  } catch (error) {
    process.stderr.write(`System check could not complete: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode
  })
}
