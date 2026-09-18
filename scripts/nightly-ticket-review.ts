import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'

import { chat } from '../src/lib/ai'
import { createPrismaNightlyReviewRepository } from '../src/lib/nightly-review-prisma.server'
import { NIGHTLY_REVIEW_MODEL } from '../src/lib/nightly-review'
import { runNightlyReviews } from '../src/lib/nightly-review.server'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | undefined

const POLL_MS = 60_000
let stopping = false

class KnownCliError extends Error {}

function safePrismaCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null
}

function writeUnexpected(prefix: string, error: unknown) {
  const code = safePrismaCode(error)
  process.stderr.write(`${prefix}${code ? ` (${code})` : ''}.\n`)
}

function usage(): never {
  throw new KnownCliError('Usage: nightly-ticket-review.ts (--once | --daemon) [--dry-run]')
}

function parseArgs(args: string[]) {
  const once = args.includes('--once')
  const daemon = args.includes('--daemon')
  const dryRun = args.includes('--dry-run')
  if (once === daemon || args.some((arg) => !['--once', '--daemon', '--dry-run'].includes(arg))) usage()
  return { once, daemon, dryRun }
}

function assertSafeEnvironment() {
  if (process.env.NIGHTLY_REVIEW_RUNNER !== '1') {
    throw new KnownCliError('Refusing to run without NIGHTLY_REVIEW_RUNNER=1')
  }
  if (!process.env.DATABASE_URL) {
    throw new KnownCliError('Refusing to run without an explicit DATABASE_URL')
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (stopping) return resolve()
    const cleanup = () => {
      clearTimeout(timer)
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      resolve()
    }
    const stop = () => cleanup()
    const timer = setTimeout(cleanup, ms)
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
}

async function tick(owner: string, dryRun: boolean) {
  const result = await runNightlyReviews({
    repository: createPrismaNightlyReviewRepository(prisma!),
    chat,
    owner,
    dryRun,
    model: process.env.AI_COACH_MODEL || NIGHTLY_REVIEW_MODEL,
  })
  process.stdout.write(`${JSON.stringify({ acquired: result.acquired, dryRun, summary: result.summary })}\n`)
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  assertSafeEnvironment()
  prisma = new PrismaClient({ log: [] })
  const owner = `${hostname()}:${process.pid}:${randomUUID()}`
  const stop = () => { stopping = true }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  if (args.once) {
    const result = await tick(owner, args.dryRun)
    if (!result.acquired) throw new KnownCliError('Another nightly review runner owns the lease')
    return
  }

  while (!stopping) {
    try {
      await tick(owner, args.dryRun)
    } catch (error) {
      writeUnexpected('Nightly review tick failed; retrying', error)
    }
    if (!stopping) await wait(POLL_MS)
  }
}

main()
  .catch((error) => {
    if (error instanceof KnownCliError) process.stderr.write(`${error.message}\n`)
    else writeUnexpected('Nightly review runner failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await prisma?.$disconnect()
    } catch (error) {
      writeUnexpected('Nightly review database disconnect failed', error)
      process.exitCode = 1
    }
  })
