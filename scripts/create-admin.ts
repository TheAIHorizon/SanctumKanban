import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { bootstrapAdmin } from '../src/lib/bootstrap-admin.server'

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run interactively in a terminal (Docker: docker compose exec app npm run db:create-admin).')
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before creating the first administrator.')
  const db = new PrismaClient({ log: [] })
  let muted = false
  const output = new Writable({ write(chunk, _encoding, done) { if (!muted) process.stdout.write(chunk); done() } })
  const rl = createInterface({ input: process.stdin, output, terminal: true })
  const controller = new AbortController()
  rl.on('SIGINT', () => controller.abort())
  const ask = (prompt: string) => rl.question(prompt, { signal: controller.signal })
  async function secret(prompt: string) {
    process.stdout.write(prompt)
    muted = true
    try { return await ask('') } finally { muted = false; process.stdout.write('\n') }
  }
  try {
    if (await db.user.count({ where: { role: 'ADMIN' } })) throw new Error('An administrator already exists. Sign in and use Users to manage accounts.')
    console.log('Creates one first administrator. No sample users, teams, or tickets are added.')
    const email = await ask('Email: ')
    const firstName = await ask('First name: ')
    const lastName = await ask('Last name: ')
    const password = await secret('Password (hidden, 12+ characters): ')
    if (password !== await secret('Confirm password (hidden): ')) throw new Error('Passwords do not match. No account was created.')
    await bootstrapAdmin(db, { email, firstName, lastName, password })
    console.log('Administrator created. Sign in with the email and password you entered.')
  } finally { rl.close(); await db.$disconnect() }
}

main().catch(error => {
  // Prisma errors can include submitted values. Print only controlled messages.
  const safe = error instanceof Error && error.constructor === Error
  console.error(safe ? error.message : 'Setup failed or was canceled. Check database connectivity/schema; if another setup ran concurrently, sign in or retry.')
  process.exitCode = 1
})
