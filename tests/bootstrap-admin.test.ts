import test from 'node:test'
import assert from 'node:assert/strict'
import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { bootstrapAdmin } from '../src/lib/bootstrap-admin.server'

const input = { email: ' Installer@Example.Invalid ', firstName: ' New ', lastName: ' Operator ', password: 'invented-test-password-123' }
function database(admins = 0, duplicate = false) {
  let created: any
  let options: any
  const db = { async $transaction(fn: any, opts: any) {
    options = opts
    return fn({ user: {
      async count() { return admins },
      async findFirst(query: any) { assert.equal(query.where.email.mode, 'insensitive'); return duplicate ? { id: 'existing' } : null },
      async create(query: any) { created = query; return { id: 'new-admin' } },
    } })
  } } as unknown as PrismaClient
  return { db, created: () => created, options: () => options }
}

test('bootstrap creates only a normalized admin with a hashed password and serializable guard', async () => {
  const fixture = database()
  assert.deepEqual(await bootstrapAdmin(fixture.db, input), { id: 'new-admin' })
  const query = fixture.created()
  assert.equal(query.data.email, 'installer@example.invalid')
  assert.equal(query.data.firstName, 'New')
  assert.equal(query.data.role, 'ADMIN')
  assert.equal(query.data.password, undefined)
  assert.equal(await bcrypt.compare(input.password, query.data.passwordHash), true)
  assert.deepEqual(query.select, { id: true })
  assert.equal(fixture.options().isolationLevel, Prisma.TransactionIsolationLevel.Serializable)
})

test('bootstrap refuses existing admins and never changes an existing email account', async () => {
  for (const [admins, duplicate, pattern] of [[1, false, /administrator already exists/], [0, true, /email already exists/]] as const) {
    const fixture = database(admins, duplicate)
    await assert.rejects(bootstrapAdmin(fixture.db, input), pattern)
    assert.equal(fixture.created(), undefined)
  }
})

test('bootstrap validates names, email and bcrypt byte limit without reflecting input', async () => {
  for (const changed of [{ email: 'bad' }, { firstName: ' ' }, { password: 'short' }, { password: 'é'.repeat(40) }]) {
    const fixture = database()
    await assert.rejects(bootstrapAdmin(fixture.db, { ...input, ...changed }), /valid email, both names/)
    assert.equal(fixture.created(), undefined)
  }
})
