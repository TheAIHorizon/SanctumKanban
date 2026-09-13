import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  RESOURCE_DEFINITIONS,
  type ResourceEntry,
  canReadClassResources,
  canWriteClassResources,
  normalizeResourceEntries,
  resourceEntriesEqual,
} from '@/lib/student-resources'
import { isTransactionConflict } from '@/lib/transaction-conflicts'

const RESOURCE_CONFLICT = 'Class resources changed; reload before saving'

class ResourcePutError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function loadWorkspace(id: string) {
  return prisma.classWorkspace.findUnique({
    where: { id },
    select: {
      id: true,
      archivedAt: true,
      members: { select: { userId: true } },
      resources: { select: { key: true, url: true } },
    },
  })
}

function sortResources(resources: ResourceEntry[]): ResourceEntry[] {
  const order = new Map(RESOURCE_DEFINITIONS.map(({ key }, index) => [key, index]))
  return [...resources].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99))
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await loadWorkspace(params.id)
  if (!workspace) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  if (!canReadClassResources(
    { id: session.user.id, role: session.user.role },
    workspace.members.map(({ userId }) => userId)
  )) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const validResources = workspace.resources.filter(({ key }) =>
    RESOURCE_DEFINITIONS.some((definition) => definition.key === key)
  ) as ResourceEntry[]
  return NextResponse.json(sortResources(validResources))
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWriteClassResources({ id: session.user.id, role: session.user.role }, false)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let entries: ResourceEntry[]
  let expectedResources: ResourceEntry[]
  try {
    const body = await request.json()
    entries = normalizeResourceEntries(body.resources)
    expectedResources = normalizeResourceEntries(body.expectedResources)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid resources' },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const workspaces = await tx.$queryRaw<{ id: string; archivedAt: Date | null }[]>`
          SELECT "id", "archivedAt"
          FROM "ClassWorkspace"
          WHERE "id" = ${params.id}
          FOR UPDATE
        `
        const workspace = workspaces[0]
        if (!workspace) throw new ResourcePutError('Class not found', 404)
        if (workspace.archivedAt) throw new ResourcePutError('Archived classes are read-only', 409)

        const stored = await tx.classResource.findMany({
          where: { classWorkspaceId: workspace.id },
          select: { key: true, url: true },
        })
        const currentResources = normalizeResourceEntries(stored)
        if (!resourceEntriesEqual(currentResources, expectedResources)) {
          throw new ResourcePutError(RESOURCE_CONFLICT, 409)
        }

        if (entries.length === 0) {
          await tx.classResource.deleteMany({ where: { classWorkspaceId: workspace.id } })
        } else {
          await tx.classResource.deleteMany({
            where: {
              classWorkspaceId: workspace.id,
              key: { notIn: entries.map(({ key }) => key) },
            },
          })
        }
        for (const { key, url } of entries) {
          await tx.classResource.upsert({
            where: { classWorkspaceId_key: { classWorkspaceId: workspace.id, key } },
            create: { classWorkspaceId: workspace.id, key, url },
            update: { url },
          })
        }

        const resources = await tx.classResource.findMany({
          where: { classWorkspaceId: workspace.id },
          select: { key: true, url: true },
        })
        return sortResources(normalizeResourceEntries(resources))
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ResourcePutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (isTransactionConflict(error)) {
      return NextResponse.json({ error: RESOURCE_CONFLICT }, { status: 409 })
    }
    console.error('Failed to update class resources:', error)
    return NextResponse.json({ error: 'Failed to update class resources' }, { status: 500 })
  }
}
