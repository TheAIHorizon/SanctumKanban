import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { checkTicketPermission } from '../src/lib/ticket-permissions'

type TicketFixture = {
  id: string
  assigneeId: string | null
  teamId: string
  team: {
    members: Array<{ userId: string; role: 'LEAD' | 'MEMBER' }>
    classWorkspace: { archivedAt: Date | null } | null
  }
}

async function withTicket(fixture: TicketFixture, run: () => Promise<void>) {
  const original = prisma.ticket.findUnique
  ;(prisma.ticket.findUnique as unknown as { bind?: unknown }) = (async () => fixture) as never
  try {
    await run()
  } finally {
    ;(prisma.ticket.findUnique as unknown as typeof original) = original
  }
}

test('observer cannot modify DCWF links even when assigned to the ticket', async () => {
  await withTicket(
    {
      id: 'ticket-1',
      assigneeId: 'observer-1',
      teamId: 'team-1',
      team: {
        members: [{ userId: 'observer-1', role: 'MEMBER' }],
        classWorkspace: { archivedAt: null },
      },
    },
    async () => {
      const result = await checkTicketPermission('ticket-1', 'observer-1', 'OBSERVER')
      assert.equal(result.ok, false)
      assert.equal(result.status, 403)
    }
  )
})

test('removed assignee cannot modify DCWF links without current team membership', async () => {
  await withTicket(
    {
      id: 'ticket-1',
      assigneeId: 'former-member',
      teamId: 'team-1',
      team: { members: [], classWorkspace: { archivedAt: null } },
    },
    async () => {
      const result = await checkTicketPermission('ticket-1', 'former-member', 'MEMBER')
      assert.equal(result.ok, false)
      assert.equal(result.status, 403)
    }
  )
})

test('archived class ticket links remain read-only for admins', async () => {
  await withTicket(
    {
      id: 'ticket-1',
      assigneeId: null,
      teamId: 'team-1',
      team: { members: [], classWorkspace: { archivedAt: new Date('2026-01-01') } },
    },
    async () => {
      const result = await checkTicketPermission('ticket-1', 'admin-1', 'ADMIN')
      assert.equal(result.ok, false)
      assert.equal(result.status, 409)
    }
  )
})
