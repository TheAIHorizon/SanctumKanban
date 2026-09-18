import test from 'node:test'
import assert from 'node:assert/strict'

import {
  REQUIRED_SCHEMA,
  checkDatabase,
  sanitizeDatabaseError,
} from '../scripts/database-check.mjs'

test('checkDatabase verifies connectivity and every required table column without reading records', async () => {
  const queries: string[] = []
  const rows = Object.entries(REQUIRED_SCHEMA).flatMap(([tableName, columns]) =>
    columns.map((columnName) => ({ table_name: tableName, column_name: columnName })),
  )
  const client = {
    async $queryRawUnsafe(query: string) {
      queries.push(query)
      return queries.length === 1 ? [{ ok: 1 }] : rows
    },
  }

  const result = await checkDatabase(client)

  assert.equal(result.status, 'passed')
  assert.equal(result.connectivity, 'passed')
  assert.equal(result.schema, 'passed')
  assert.equal(result.tablesChecked, Object.keys(REQUIRED_SCHEMA).length)
  assert.equal(result.columnsChecked, rows.length)
  assert.equal(queries.length, 2)
  assert.match(queries[0], /^SELECT 1/)
  assert.match(queries[1], /information_schema\.columns/)
  assert.doesNotMatch(queries.join('\n'), /SELECT \*|passwordHash/)
})

test('checkDatabase distinguishes a reachable database with missing schema', async () => {
  let call = 0
  const client = {
    async $queryRawUnsafe() {
      call += 1
      return call === 1 ? [{ ok: 1 }] : [{ table_name: 'User', column_name: 'id' }]
    },
  }

  const result = await checkDatabase(client)

  assert.equal(result.status, 'failed')
  assert.equal(result.connectivity, 'passed')
  assert.equal(result.schema, 'failed')
  assert.ok(result.missingTables)
  assert.ok(result.missingColumns)
  assert.ok(result.missingTables.includes('Team'))
  assert.ok(result.missingColumns.includes('User.email'))
  assert.match(result.message, /schema is missing/i)
  assert.doesNotMatch(JSON.stringify(result), /postgres(?:ql)?:\/\//i)
})

test('checkDatabase reports an unreachable database without leaking Prisma URLs or credentials', async () => {
  const secretUrl = 'postgresql://sanctum:super-secret@127.0.0.1:65432/sanctum_kanban'
  const client = {
    async $queryRawUnsafe() {
      const error = new Error(`Can't reach database server at ${secretUrl}\nhttps://pris.ly/d/p1001`)
      Object.assign(error, { code: 'P1001' })
      throw error
    },
  }

  const result = await checkDatabase(client)

  assert.equal(result.status, 'failed')
  assert.equal(result.connectivity, 'failed')
  assert.equal(result.schema, 'not-run')
  assert.match(result.message, /unreachable/i)
  assert.doesNotMatch(JSON.stringify(result), /super-secret|postgres(?:ql)?:\/\/|pris\.ly/i)
})

test('sanitizeDatabaseError provides a generic safe fallback', () => {
  const message = sanitizeDatabaseError(new Error('bad postgresql://user:secret@localhost/db https://pris.ly/d/error'))
  assert.equal(message, 'Database check failed. Review the local database configuration and server logs.')
})
