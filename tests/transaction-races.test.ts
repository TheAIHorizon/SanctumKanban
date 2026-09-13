import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isTransactionConflict } from '../src/lib/transaction-conflicts'

test('serialization and PostgreSQL deadlock failures are retryable conflicts', () => {
  assert.equal(isTransactionConflict({ code: 'P2034' }), true)
  assert.equal(isTransactionConflict({ code: 'P2010', meta: { code: '40001' } }), true)
  assert.equal(isTransactionConflict({ code: 'P2010', meta: { code: '40P01' } }), true)
  assert.equal(isTransactionConflict(new Error('ordinary failure')), false)
})

test('reorder locks and re-reads tickets, team, class archive state, and membership inside its transaction', () => {
  const source = readFileSync('src/app/api/tickets/[id]/reorder/route.ts', 'utf8')
  const transactionStart = source.indexOf('prisma.$transaction')

  assert.ok(transactionStart >= 0)
  assert.ok(source.indexOf('FOR UPDATE', transactionStart) > transactionStart)
  assert.ok(source.indexOf('tx.ticket.findMany', transactionStart) > transactionStart)
  assert.ok(source.indexOf('tx.teamMember.findUnique', transactionStart) > transactionStart)
  assert.ok(source.indexOf('canReorderTicket', transactionStart) > transactionStart)
  assert.doesNotMatch(source.slice(0, transactionStart), /canReorderTicket\(/)
})

test('all locked mutation routes map transaction serialization and deadlock conflicts to HTTP 409', () => {
  const routes = [
    'src/app/api/classes/[id]/resources/route.ts',
    'src/app/api/teams/[id]/note/route.ts',
    'src/app/api/tickets/[id]/reorder/route.ts',
  ]

  for (const route of routes) {
    const source = readFileSync(route, 'utf8')
    assert.match(source, /isTransactionConflict\(error\)/, route)
    assert.match(source, /status: 409/, route)
    assert.doesNotMatch(source, /\$queryRawUnsafe|\$executeRawUnsafe/, route)
  }
})