#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { pathToFileURL } from 'node:url'

export const REQUIRED_SCHEMA = Object.freeze({
  User: ['id', 'email', 'firstName', 'lastName', 'contactInfo', 'color', 'role', 'passwordHash', 'createdAt', 'updatedAt'],
  Team: ['id', 'name', 'description', 'classWorkspaceId', 'createdAt', 'updatedAt'],
  Ticket: ['id', 'title', 'description', 'status', 'position', 'startDate', 'startedAt', 'startDateAutoFilled', 'dueDate', 'completedAt', 'teamId', 'assigneeId', 'createdById', 'archived', 'archivedAt', 'archivedById', 'createdAt', 'updatedAt'],
  ClassWorkspace: ['id', 'name', 'code', 'term', 'description', 'archivedAt', 'createdById', 'createdAt', 'updatedAt'],
  ClassResource: ['id', 'classWorkspaceId', 'key', 'url', 'createdAt', 'updatedAt'],
  TeamNote: ['id', 'teamId', 'content', 'revision', 'createdAt', 'updatedAt'],
})

const SCHEMA_QUERY = `
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('User', 'Team', 'Ticket', 'ClassWorkspace', 'ClassResource', 'TeamNote')
ORDER BY table_name, ordinal_position
`

export function sanitizeDatabaseError(error) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  const rawMessage = error instanceof Error ? error.message : String(error)

  if (code === 'P1001' || /can(?:not|'t) reach database server|ECONNREFUSED|connection refused/i.test(rawMessage)) {
    return 'Database is unreachable. Check that PostgreSQL is running and DATABASE_URL points to an accessible database.'
  }
  if (code === 'P1003' || /database .* does not exist/i.test(rawMessage)) {
    return 'Configured database does not exist. Check the database name in DATABASE_URL.'
  }
  if (code === 'P1010' || /access denied|permission denied/i.test(rawMessage)) {
    return 'Database access was denied. Check the configured database role and its read permissions.'
  }
  if (/DATABASE_URL|environment variable not found/i.test(rawMessage)) {
    return 'Database configuration is unavailable. Set DATABASE_URL in the runtime environment.'
  }
  return 'Database check failed. Review the local database configuration and server logs.'
}

export async function checkDatabase(client) {
  try {
    await client.$queryRawUnsafe('SELECT 1 AS ok')
  } catch (error) {
    return {
      status: 'failed',
      connectivity: 'failed',
      schema: 'not-run',
      message: sanitizeDatabaseError(error),
    }
  }

  let rows
  try {
    rows = await client.$queryRawUnsafe(SCHEMA_QUERY)
  } catch (error) {
    return {
      status: 'failed',
      connectivity: 'passed',
      schema: 'failed',
      message: sanitizeDatabaseError(error),
    }
  }

  const found = new Map()
  for (const row of rows) {
    if (typeof row?.table_name !== 'string' || typeof row?.column_name !== 'string') continue
    const columns = found.get(row.table_name) ?? new Set()
    columns.add(row.column_name)
    found.set(row.table_name, columns)
  }

  const missingTables = []
  const missingColumns = []
  let columnsChecked = 0
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    const actualColumns = found.get(tableName)
    if (!actualColumns) {
      missingTables.push(tableName)
      continue
    }
    for (const columnName of requiredColumns) {
      columnsChecked += 1
      if (!actualColumns.has(columnName)) missingColumns.push(`${tableName}.${columnName}`)
    }
  }

  if (missingTables.length || missingColumns.length) {
    const details = [
      missingTables.length ? `tables: ${missingTables.join(', ')}` : null,
      missingColumns.length ? `columns: ${missingColumns.join(', ')}` : null,
    ].filter(Boolean).join('; ')
    return {
      status: 'failed',
      connectivity: 'passed',
      schema: 'failed',
      tablesChecked: Object.keys(REQUIRED_SCHEMA).length,
      columnsChecked,
      missingTables,
      missingColumns,
      message: `Database schema is missing required ${details}. Apply the required Prisma migrations before using the app.`,
    }
  }

  return {
    status: 'passed',
    connectivity: 'passed',
    schema: 'passed',
    tablesChecked: Object.keys(REQUIRED_SCHEMA).length,
    columnsChecked,
    missingTables: [],
    missingColumns: [],
    message: 'Database connectivity and required schema verified.',
  }
}

export async function main() {
  const client = new PrismaClient()
  try {
    const result = await checkDatabase(client)
    const line = result.status === 'passed'
      ? `Database check PASSED: connectivity and required schema verified (${result.tablesChecked} tables, ${result.columnsChecked} columns).\n`
      : `Database check FAILED: ${result.message}\n`
    const stream = result.status === 'passed' ? process.stdout : process.stderr
    stream.write(line)
    return result.status === 'passed' ? 0 : 1
  } finally {
    await client.$disconnect().catch(() => {})
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    process.stderr.write(`Database check FAILED: ${sanitizeDatabaseError(error)}\n`)
    process.exitCode = 1
  })
}
