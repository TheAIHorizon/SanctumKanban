import { Prisma } from '@prisma/client'

import defaultPrisma from './prisma'
import { computeNightlyInputHash } from './nightly-review'
import type {
  NightlyReviewRepository,
  ReviewClass,
  ReviewTicket,
  SavedReview,
} from './nightly-review.server'
import type { DcwfCandidate } from './dcwf-suggest'

const LEASE_ID = 'global'

async function guardLiveLease(tx: Prisma.TransactionClient, owner: string): Promise<boolean> {
  const lease = await tx.$queryRaw<Array<{ owner: string }>>`
    SELECT "owner"
    FROM "NightlyReviewLease"
    WHERE "id" = ${LEASE_ID}
      AND "owner" = ${owner}
      AND "expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    FOR UPDATE
  `
  return lease[0]?.owner === owner
}

const ticketSelect = {
  id: true,
  title: true,
  description: true,
  teamId: true,
  archived: true,
  team: { select: { classWorkspaceId: true } },
  aiGuidanceReviews: { select: { inputHash: true, mode: true, nextRetryAt: true } },
} satisfies Prisma.TicketSelect

type TicketRow = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>

function mapTicket(row: TicketRow): ReviewTicket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teamId: row.teamId,
    classWorkspaceId: row.team.classWorkspaceId,
    archived: row.archived,
    reviews: row.aiGuidanceReviews,
  }
}

interface LockedTicketRow {
  id: string
  title: string
  description: string | null
  archived: boolean
  teamId: string
  classWorkspaceId: string | null
  nightlyReviewEnabled: boolean
  classArchivedAt: Date | null
}

/** Prisma-backed repository. Tagged SQL provides atomic, conditional lease operations. */
export function createPrismaNightlyReviewRepository(prisma = defaultPrisma): NightlyReviewRepository {
  return {
    async acquireLease(owner, now, expiresAt) {
      const rows = await prisma.$queryRaw<Array<{ owner: string }>>`
        INSERT INTO "NightlyReviewLease" ("id", "owner", "expiresAt")
        VALUES (${LEASE_ID}, ${owner}, CAST(${expiresAt.toISOString()} AS timestamp))
        ON CONFLICT ("id") DO UPDATE
        SET "owner" = EXCLUDED."owner", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "NightlyReviewLease"."expiresAt" <= CAST(${now.toISOString()} AS timestamp)
           OR "NightlyReviewLease"."owner" = ${owner}
        RETURNING "owner"
      `
      return rows[0]?.owner === owner
    },

    async heartbeatLease(owner, now, expiresAt) {
      const result = await prisma.nightlyReviewLease.updateMany({
        where: { id: LEASE_ID, owner, expiresAt: { gt: now } },
        data: { expiresAt },
      })
      return result.count === 1
    },

    async ownsLease(owner, now) {
      return Boolean(await prisma.nightlyReviewLease.findFirst({
        where: { id: LEASE_ID, owner, expiresAt: { gt: now } },
        select: { id: true },
      }))
    },

    async releaseLease(owner) {
      await prisma.nightlyReviewLease.deleteMany({ where: { id: LEASE_ID, owner } })
    },

    async listClasses(): Promise<ReviewClass[]> {
      return prisma.classWorkspace.findMany({
        where: { nightlyReviewEnabled: true, archivedAt: null },
        select: {
          id: true,
          archivedAt: true,
          nightlyReviewEnabled: true,
          nightlyReviewHour: true,
          nightlyReviewTimezone: true,
          nightlyReviewRequestedAt: true,
          nightlyReviewLastRunAt: true,
          nightlyReviewLastRunDate: true,
        },
        orderBy: { id: 'asc' },
      })
    },

    async listTickets(classId) {
      const rows = await prisma.ticket.findMany({
        where: {
          archived: false,
          team: {
            classWorkspaceId: classId,
            classWorkspace: { is: { archivedAt: null, nightlyReviewEnabled: true } },
          },
        },
        select: ticketSelect,
        orderBy: { id: 'asc' },
      })
      return rows.map(mapTicket)
    },

    async reloadTicket(ticketId, classId) {
      const row = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          archived: false,
          team: {
            classWorkspaceId: classId,
            classWorkspace: { is: { archivedAt: null, nightlyReviewEnabled: true } },
          },
        },
        select: ticketSelect,
      })
      return row ? mapTicket(row) : null
    },

    async loadCandidates(): Promise<DcwfCandidate[]> {
      const rows = await prisma.dcwfKsat.findMany({
        where: { type: 'Task', roles: { some: { workRole: { inScope: true } } } },
        orderBy: { ksatId: 'asc' },
        select: {
          id: true,
          ksatId: true,
          description: true,
          roles: {
            select: {
              coreOrAdditional: true,
              workRole: { select: { code: true, title: true, inScope: true } },
            },
          },
        },
      })
      return rows.map((row) => ({
        id: row.id,
        ksatId: row.ksatId,
        description: row.description,
        workRoles: row.roles.map((role) => ({
          code: role.workRole.code,
          title: role.workRole.title,
          inScope: role.workRole.inScope,
          coreOrAdditional: role.coreOrAdditional,
        })),
      }))
    },

    async saveReview(review: SavedReview, guard) {
      return prisma.$transaction(async (tx) => {
        const lease = await tx.$queryRaw<Array<{ owner: string; expiresAt: Date }>>`
          SELECT "owner", "expiresAt"
          FROM "NightlyReviewLease"
          WHERE "id" = ${LEASE_ID}
            AND "owner" = ${guard.owner}
            AND "expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          FOR UPDATE
        `
        const locked = await tx.$queryRaw<LockedTicketRow[]>`
          SELECT t."id", t."title", t."description", t."archived", t."teamId",
                 team."classWorkspaceId", cw."nightlyReviewEnabled",
                 cw."archivedAt" AS "classArchivedAt"
          FROM "Ticket" t
          JOIN "Team" team ON team."id" = t."teamId"
          JOIN "ClassWorkspace" cw ON cw."id" = team."classWorkspaceId"
          WHERE t."id" = ${review.ticketId}
          FOR UPDATE OF t, team, cw
        `
        const current = locked[0]
        if (
          !lease[0] ||
          !current || current.archived || current.classArchivedAt || !current.nightlyReviewEnabled ||
          current.teamId !== guard.teamId || current.classWorkspaceId !== guard.classId ||
          current.title !== guard.title || current.description !== guard.description ||
          computeNightlyInputHash({
            title: current.title,
            description: current.description,
            model: guard.model,
            promptVersion: guard.promptVersion,
          }) !== review.inputHash
        ) return false

        const data = {
          model: review.model,
          mode: review.mode,
          guidance: review.guidance as unknown as Prisma.InputJsonValue,
          tasks: review.tasks as unknown as Prisma.InputJsonValue,
          candidateCount: review.candidateCount,
          lastAttemptAt: review.lastAttemptAt,
          nextRetryAt: review.nextRetryAt,
        }
        await tx.ticketAiGuidance.upsert({
          where: { ticketId_inputHash: { ticketId: review.ticketId, inputHash: review.inputHash } },
          create: { ticketId: review.ticketId, inputHash: review.inputHash, ...data },
          update: data,
        })
        return true
      })
    },

    async finishClassRun(result) {
      return prisma.$transaction(async (tx) => {
        if (!await guardLiveLease(tx, result.owner)) return false
        const updated = await tx.classWorkspace.updateMany({
          where: {
            id: result.classId,
            archivedAt: null,
            nightlyReviewEnabled: true,
            nightlyReviewHour: result.scheduleHour,
            nightlyReviewTimezone: result.scheduleTimezone,
          },
          data: {
            nightlyReviewLastRunAt: result.now,
            ...(result.complete ? { nightlyReviewLastRunDate: result.localRunDate } : {}),
            nightlyReviewLastError: result.error,
            nightlyReviewLastSummary: result.summary as unknown as Prisma.InputJsonValue,
          },
        })
        if (result.complete && result.processedRequestedAt) {
          await tx.classWorkspace.updateMany({
            where: {
              id: result.classId,
              archivedAt: null,
              nightlyReviewEnabled: true,
              nightlyReviewHour: result.scheduleHour,
              nightlyReviewTimezone: result.scheduleTimezone,
              nightlyReviewRequestedAt: result.processedRequestedAt,
            },
            data: { nightlyReviewRequestedAt: null },
          })
        }
        return updated.count === 1
      })
    },

    async failClassRun(result) {
      return prisma.$transaction(async (tx) => {
        if (!await guardLiveLease(tx, result.owner)) return false
        const updated = await tx.classWorkspace.updateMany({
          where: {
            id: result.classId,
            archivedAt: null,
            nightlyReviewEnabled: true,
            nightlyReviewHour: result.scheduleHour,
            nightlyReviewTimezone: result.scheduleTimezone,
          },
          data: {
            nightlyReviewLastError: result.error,
            nightlyReviewLastSummary: result.summary as unknown as Prisma.InputJsonValue,
          },
        })
        return updated.count === 1
      })
    },
  }
}
