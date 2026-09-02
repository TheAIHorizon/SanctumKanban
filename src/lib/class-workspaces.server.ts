import prisma from '@/lib/prisma'
import { legacyClassMemberIds } from './class-workspaces'

export const LEGACY_CLASS_NAME = 'Current Class'

/**
 * Backward-compatible bootstrap for upgrades from the single-board schema.
 * Existing unassigned teams (and their users) are moved into one default class.
 * Safe and idempotent: once no unassigned teams remain it is a no-op.
 */
export async function ensureLegacyClassWorkspace() {
  const unassigned = await prisma.team.findMany({
    where: { classWorkspaceId: null },
    select: { id: true, members: { select: { userId: true } } },
  })

  if (!unassigned.length) return null

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!admin) return null

  return prisma.$transaction(async (tx) => {
    // A concurrent request may have bootstrapped while we were waiting.
    const remaining = await tx.team.findMany({
      where: { id: { in: unassigned.map((team) => team.id) }, classWorkspaceId: null },
      select: { id: true },
    })
    if (!remaining.length) return null

    const workspace = await tx.classWorkspace.create({
      data: {
        name: LEGACY_CLASS_NAME,
        description: 'Automatically created for boards that existed before class workspaces were enabled.',
        createdById: admin.id,
      },
    })

    const teamIds = remaining.map((team) => team.id)
    await tx.team.updateMany({
      where: { id: { in: teamIds } },
      data: { classWorkspaceId: workspace.id },
    })

    const memberIds = legacyClassMemberIds(
      unassigned.filter((team) => teamIds.includes(team.id))
    )
    await tx.classWorkspaceMember.createMany({
      data: memberIds.map((userId) => ({
        classWorkspaceId: workspace.id,
        userId,
      })),
      skipDuplicates: true,
    })

    // Legacy cohort imports belong with the legacy class as well.
    await tx.cohort.updateMany({
      where: { classWorkspaceId: null },
      data: { classWorkspaceId: workspace.id },
    })

    return workspace
  })
}

/** Classes available to a principal, including member ids for pure selection logic. */
export async function loadClassWorkspaceSummaries() {
  await ensureLegacyClassWorkspace()
  return prisma.classWorkspace.findMany({
    include: {
      members: { select: { userId: true } },
      _count: { select: { teams: true } },
    },
    orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
  })
}

/** Returns true when a team's parent class is active/writeable. */
export async function isTeamClassWritable(teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { classWorkspace: { select: { archivedAt: true } } },
  })
  // Legacy unassigned teams remain writable until bootstrap can run.
  return !team?.classWorkspace?.archivedAt
}
