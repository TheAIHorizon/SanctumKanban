import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { REQUIRED_SCHEMA } from '../scripts/database-check.mjs'

const read = (path: string) => readFileSync(path, 'utf8')

test('Ticket schema and additive migration add nullable calendar startDate without backfill', () => {
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260915_add_ticket_start_date/migration.sql')

  assert.match(schema, /startDate\s+DateTime\?\s+@db\.Date/)
  assert.match(schema, /dueDate\s+DateTime\?\s*(?:\r?\n)/)
  assert.match(migration, /ALTER TABLE "Ticket" ADD COLUMN "startDate" DATE;/)
  assert.doesNotMatch(migration, /UPDATE|DEFAULT|NOT NULL/i)
  assert.ok(REQUIRED_SCHEMA.Ticket.includes('startDate'))
})

test('ticket create validates schedule and writes parsed dates', () => {
  const source = read('src/app/api/tickets/route.ts')

  assert.match(source, /validateTicketSchedule/)
  assert.match(source, /startDate:\s*schedule\.updates\.startDate/)
  assert.match(source, /dueDate:\s*schedule\.updates\.dueDate/)
  assert.ok(source.indexOf('validateTicketSchedule') < source.indexOf('prisma.ticket.create'))
})

test('ticket PATCH validates the merged schedule before tags or ticket mutations', () => {
  const source = read('src/app/api/tickets/[id]/route.ts')
  const patchSource = source.slice(source.indexOf('export async function PATCH'), source.indexOf('export async function DELETE'))
  const validation = patchSource.lastIndexOf('validateTicketSchedule')

  assert.match(patchSource, /startDate:[^\n]*ticket[^\n]*startDate/)
  assert.match(patchSource, /dueDate:\s*ticket\.dueDate/)
  assert.match(patchSource, /\.\.\.schedule\.updates/)
  assert.ok(validation >= 0)
  assert.ok(validation < patchSource.indexOf('prisma.ticketTag.deleteMany'))
  assert.ok(validation < patchSource.indexOf('prisma.ticket.update'))
})

test('create and edit dialogs expose start/due date-only inputs and send both values', () => {
  const create = read('src/components/kanban/CreateTicketDialog.tsx')
  const edit = read('src/components/kanban/EditTicketDialog.tsx')

  assert.match(create, /const \[startDate, setStartDate\] = useState\(''\)/)
  assert.match(create, /id="start-date"[\s\S]*?type="date"/)
  assert.match(create, /startDate: startDate \|\| null/)
  assert.match(create, /setStartDate\(''\)/)
  assert.match(create, /validateTicketSchedule/)

  assert.match(edit, /startDate\?: Date \| string \| null/)
  assert.match(edit, /id="edit-start-date"[\s\S]*?type="date"/)
  assert.match(edit, /startDate: startDate \|\| null/)
  assert.match(edit, /setStartDate\(ticket\.startDate/)
  assert.match(edit, /validateTicketSchedule/)
})
