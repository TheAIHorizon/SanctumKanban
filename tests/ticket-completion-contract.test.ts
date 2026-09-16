import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { REQUIRED_SCHEMA } from '../scripts/database-check.mjs'

const read = (path: string) => readFileSync(path, 'utf8')

test('Ticket completedAt is nullable and its additive migration performs no historical backfill', () => {
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260916_add_ticket_completed_at/migration.sql')

  assert.match(schema, /completedAt\s+DateTime\?/)
  assert.match(migration, /ALTER TABLE "Ticket" ADD COLUMN "completedAt" TIMESTAMP\(3\);/)
  assert.doesNotMatch(migration, /UPDATE|DEFAULT|NOT NULL/i)
  assert.ok(REQUIRED_SCHEMA.Ticket.includes('completedAt'))
})

test('ticket creation validates status, rejects completedAt, and timestamps direct DONE creation', () => {
  const source = read('src/app/api/tickets/route.ts')
  const post = source.slice(source.indexOf('export async function POST'), source.indexOf('// GET'))

  assert.match(post, /hasOwn\(body, ['"]completedAt['"]\)/)
  assert.match(post, /isTicketStatus/)
  assert.match(post, /completionForNewTicket/)
  assert.match(post, /completedAt/)
  assert.ok(post.indexOf('isTicketStatus') < post.indexOf('prisma.ticket.create'))
})

test('ticket PATCH locks and re-reads authorization and archive state before atomic mutations', () => {
  const source = read('src/app/api/tickets/[id]/route.ts')
  const patch = source.slice(source.indexOf('export async function PATCH'), source.indexOf('export async function DELETE'))
  const transaction = patch.indexOf('prisma.$transaction')

  assert.ok(transaction >= 0)
  assert.match(patch, /hasOwn\(body, ['"]completedAt['"]\)/)
  assert.ok(patch.indexOf('isTicketStatus') < transaction)
  assert.ok(patch.indexOf('FOR UPDATE', transaction) > transaction)
  assert.ok(patch.indexOf('tx.ticket.findUnique', transaction) > transaction)
  assert.ok(patch.indexOf('tx.teamMember.findUnique', transaction) > transaction)
  assert.ok(patch.indexOf('can(', transaction) > transaction)
  assert.ok(patch.indexOf('archivedAt', transaction) > transaction)
  assert.ok(patch.indexOf('tx.ticketTag.deleteMany', transaction) > transaction)
  assert.ok(patch.indexOf('tx.ticket.update', transaction) > transaction)
  assert.ok(patch.indexOf('tx.ticketHistory.create', transaction) > transaction)
  assert.doesNotMatch(patch, /\$queryRawUnsafe|\$executeRawUnsafe/)
})

test('ticket PATCH preserves moved history action and records completion transition details', () => {
  const source = read('src/app/api/tickets/[id]/route.ts')
  const patch = source.slice(source.indexOf('export async function PATCH'), source.indexOf('export async function DELETE'))

  assert.match(patch, /planCompletionTransition/)
  assert.match(patch, /action:\s*['"]moved['"]/)
  assert.match(patch, /details:\s*JSON\.stringify\(completionPlan\.historyDetails\)/)
  assert.match(patch, /isTransactionConflict\(error\)/)
  assert.match(patch, /status:\s*409/)
})
