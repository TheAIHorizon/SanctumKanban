import type { Prisma } from '@prisma/client'
import {
  BONUS_EXTRA_TAG,
  REQUIRED_TAG,
  type DeliverableInput,
  planDeliverableDistribution,
  workflowTagFor,
} from './deliverables'

/** Narrow transaction surface used here; exported so tests can supply a fake. */
export type DeliverablesTransaction = Pick<
  Prisma.TransactionClient,
  'classWorkspace' | 'tag' | 'ticket' | 'ticketHistory'
>

export class DeliverableDistributionError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'DeliverableDistributionError'
  }
}

async function findOrCreateGlobalTag(
  tx: DeliverablesTransaction,
  name: typeof REQUIRED_TAG | typeof BONUS_EXTRA_TAG
): Promise<{ id: string }> {
  const existing = await tx.tag.findFirst({
    where: { name, teamId: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing
  return tx.tag.create({ data: { name, teamId: null, color: name === REQUIRED_TAG ? '#dc2626' : '#7c3aed' }, select: { id: true } })
}

export async function distributeDeliverablesInTransaction(
  tx: DeliverablesTransaction,
  classId: string,
  adminUserId: string,
  deliverables: readonly DeliverableInput[]
): Promise<{ created: number; skipped: number; teams: number; deliverables: number }> {
  const workspace = await tx.classWorkspace.findUnique({
    where: { id: classId },
    select: { archivedAt: true, teams: { select: { id: true }, orderBy: { id: 'asc' } } },
  })
  if (!workspace) throw new DeliverableDistributionError('Class not found', 404)
  if (workspace.archivedAt) {
    throw new DeliverableDistributionError('Archived classes are read-only', 409)
  }

  const teams: Array<{ id: string }> = workspace.teams
  if (teams.length === 0) {
    return { created: 0, skipped: 0, teams: 0, deliverables: deliverables.length }
  }

  const neededKinds = new Set(deliverables.map((item) => item.kind))
  const tagIds = new Map<string, string>()
  if (neededKinds.has('required')) {
    tagIds.set(REQUIRED_TAG, (await findOrCreateGlobalTag(tx, REQUIRED_TAG)).id)
  }
  if (neededKinds.has('bonus')) {
    tagIds.set(BONUS_EXTRA_TAG, (await findOrCreateGlobalTag(tx, BONUS_EXTRA_TAG)).id)
  }

  const workflowTagNames = Array.from(tagIds.keys())
  const existing = await tx.ticket.findMany({
    where: {
      teamId: { in: teams.map((team) => team.id) },
      archived: false,
      tags: { some: { tag: { name: { in: workflowTagNames }, teamId: null } } },
    },
    select: {
      teamId: true,
      title: true,
      tags: {
        where: { tag: { name: { in: workflowTagNames }, teamId: null } },
        select: { tag: { select: { name: true } } },
      },
    },
  })
  const taggedTickets = existing.flatMap((ticket) =>
    ticket.tags.map((link) => ({
      teamId: ticket.teamId,
      title: ticket.title,
      tagName: link.tag.name,
    }))
  )
  const plan = planDeliverableDistribution(teams, deliverables, taggedTickets)

  const nextPositions = new Map<string, number>()
  for (const team of teams) {
    const highest = await tx.ticket.findFirst({
      where: { teamId: team.id, status: 'BACKLOG' },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    nextPositions.set(team.id, highest?.position ?? 0)
  }

  for (const item of plan.create) {
    const position = (nextPositions.get(item.teamId) ?? 0) + 1
    nextPositions.set(item.teamId, position)
    const tagName = workflowTagFor(item.deliverable.kind)
    const ticket = await tx.ticket.create({
      data: {
        title: item.deliverable.title,
        description: item.deliverable.description,
        status: 'BACKLOG',
        position,
        teamId: item.teamId,
        createdById: adminUserId,
        tags: { create: [{ tagId: tagIds.get(tagName)! }] },
      },
      select: { id: true, status: true },
    })
    await tx.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        userId: adminUserId,
        action: 'created',
        toStatus: ticket.status,
        details: JSON.stringify({ source: 'class-deliverables', kind: item.deliverable.kind }),
      },
    })
  }

  return {
    created: plan.create.length,
    skipped: plan.skipped,
    teams: teams.length,
    deliverables: deliverables.length,
  }
}
