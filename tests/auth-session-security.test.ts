import test from 'node:test'
import assert from 'node:assert/strict'
import { authOptions } from '../src/lib/auth'
import prisma from '../src/lib/prisma'

const jwtCallback = authOptions.callbacks?.jwt
assert.ok(jwtCallback)
const observerProvider = authOptions.providers.find(
  (provider) => (provider as { options?: { id?: string } }).options?.id === 'observer'
) as { options?: { authorize?: () => Promise<{ id?: string } | null> } } | undefined
const observerAuthorize = observerProvider?.options?.authorize
assert.ok(observerAuthorize)

async function withAuthoritativeUser(
  user: { id: string; role: 'ADMIN' | 'TEAM_LEAD' | 'MEMBER' | 'OBSERVER'; color: string; firstName: string; lastName: string } | null,
  run: () => Promise<void>
) {
  const original = prisma.user.findUnique
  ;(prisma.user.findUnique as unknown as { bind?: unknown }) = (async () => user) as never
  try {
    await run()
  } finally {
    ;(prisma.user.findUnique as unknown as typeof original) = original
  }
}

test('JWT refresh replaces stale elevated role with the database role', async () => {
  await withAuthoritativeUser(
    { id: 'user-1', role: 'MEMBER', color: '#123456', firstName: 'New', lastName: 'Name' },
    async () => {
      const token = await jwtCallback({
        token: {
          id: 'user-1',
          role: 'ADMIN',
          color: '#ffffff',
          firstName: 'Old',
          lastName: 'Name',
        },
      } as never)
      assert.equal(token.role, 'MEMBER')
      assert.equal(token.firstName, 'New')
    }
  )
})

test('JWT refresh rejects a deleted user instead of preserving authorization', async () => {
  await withAuthoritativeUser(null, async () => {
    await assert.rejects(
      () =>
        Promise.resolve(
          jwtCallback({
            token: {
              id: 'deleted-user',
              role: 'ADMIN',
              color: '#ffffff',
              firstName: 'Deleted',
              lastName: 'Admin',
            },
          } as never)
        ),
      /no longer exists/i
    )
  })
})

test('passwordless observer JWT cannot inherit a later privileged database role', async () => {
  const guestToken = await jwtCallback({
    token: {},
    user: {
      id: 'observer-1',
      role: 'OBSERVER',
      color: '#64748b',
      firstName: 'Guest',
      lastName: 'Observer',
    },
    account: { provider: 'observer' },
  } as never)

  await withAuthoritativeUser(
    { id: 'observer-1', role: 'ADMIN', color: '#64748b', firstName: 'Guest', lastName: 'Observer' },
    async () => {
      await assert.rejects(
        () => Promise.resolve(jwtCallback({ token: guestToken } as never)),
        /guest observer.*invalid/i
      )
    }
  )
})

test('passwordless login uses only the dedicated local observer identity', async () => {
  const originalFindFirst = prisma.user.findFirst
  const originalFindUnique = prisma.user.findUnique
  const dedicatedObserver = {
    id: 'dedicated-observer',
    email: 'observer@local',
    passwordHash: 'unused',
    firstName: 'Guest',
    lastName: 'Observer',
    contactInfo: null,
    role: 'OBSERVER' as const,
    color: '#64748b',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  ;(prisma.user.findFirst as unknown as { bind?: unknown }) = (async () => {
    throw new Error('arbitrary observer lookup must not be used')
  }) as never
  ;(prisma.user.findUnique as unknown as { bind?: unknown }) = (async (query: unknown) => {
    assert.deepEqual(query, { where: { email: 'observer@local' } })
    return dedicatedObserver
  }) as never
  try {
    const result = await observerAuthorize()
    assert.equal(result?.id, dedicatedObserver.id)
  } finally {
    ;(prisma.user.findFirst as unknown as typeof originalFindFirst) = originalFindFirst
    ;(prisma.user.findUnique as unknown as typeof originalFindUnique) = originalFindUnique
  }
})
