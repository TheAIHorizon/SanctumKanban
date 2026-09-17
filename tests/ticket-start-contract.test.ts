import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { REQUIRED_SCHEMA } from '../scripts/database-check.mjs'

const read = (path: string) => readFileSync(path, 'utf8')

test('actual-start schema is additive, nullable, defaults only the provenance flag, and performs no backfill', () => {
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260917_add_ticket_actual_start/migration.sql')

  assert.match(schema, /startedAt\s+DateTime\?/)
  assert.match(schema, /startDateAutoFilled\s+Boolean\s+@default\(false\)/)
  assert.match(migration, /ADD COLUMN "startedAt" TIMESTAMP\(3\)/)
  assert.match(migration, /ADD COLUMN "startDateAutoFilled" BOOLEAN NOT NULL DEFAULT false/)
  assert.doesNotMatch(migration, /UPDATE/i)
  assert.ok(REQUIRED_SCHEMA.Ticket.includes('startedAt'))
  assert.ok(REQUIRED_SCHEMA.Ticket.includes('startDateAutoFilled'))
})

test('ticket APIs reject forged actual-start fields and derive start atomically with history', () => {
  const create = read('src/app/api/tickets/route.ts').split('// GET')[0]
  const updateSource = read('src/app/api/tickets/[id]/route.ts')
  const update = updateSource.slice(updateSource.indexOf('export async function PATCH'), updateSource.indexOf('export async function DELETE'))

  for (const source of [create, update]) {
    assert.match(source, /startedAt/)
    assert.match(source, /startDateAutoFilled/)
    assert.match(source, /read-only/)
  }
  assert.match(create, /planStartForNewTicket/)
  assert.match(create, /historyDetails/)
  assert.match(update, /planStartTransition/)
  assert.match(update, /startDateAutoFilled:\s*ticket\.startDateAutoFilled/)
  assert.match(update, /details:\s*JSON\.stringify\(historyDetails\)/)
})
