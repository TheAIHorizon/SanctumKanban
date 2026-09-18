import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { parseNightlySettingsPatch } from '@/lib/nightly-review'
import prisma from '@/lib/prisma'

const selectSettings = {
  id: true,
  nightlyReviewEnabled: true,
  nightlyReviewHour: true,
  nightlyReviewTimezone: true,
  nightlyReviewRequestedAt: true,
  nightlyReviewLastRunAt: true,
  nightlyReviewLastRunDate: true,
  nightlyReviewLastError: true,
  nightlyReviewLastSummary: true,
} as const

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.user.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { session }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const authorization = await requireAdmin()
  if ('error' in authorization) return authorization.error
  const workspace = await prisma.classWorkspace.findUnique({ where: { id: params.id }, select: { ...selectSettings, archivedAt: true } })
  if (!workspace) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  return NextResponse.json(workspace)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authorization = await requireAdmin()
  if ('error' in authorization) return authorization.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const data = parseNightlySettingsPatch(body)
  if (!data) return NextResponse.json({ error: 'Expected enabled:boolean, hour:0-23, and/or a valid timeZone' }, { status: 400 })

  const existing = await prisma.classWorkspace.findUnique({ where: { id: params.id }, select: { id: true, archivedAt: true } })
  if (!existing) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  if (existing.archivedAt) return NextResponse.json({ error: 'Archived classes are read-only' }, { status: 409 })

  const changed = await prisma.classWorkspace.updateMany({
    where: { id: params.id, archivedAt: null },
    data,
  })
  if (changed.count !== 1) return NextResponse.json({ error: 'Class is no longer active' }, { status: 409 })
  const updated = await prisma.classWorkspace.findUniqueOrThrow({ where: { id: params.id }, select: selectSettings })
  return NextResponse.json(updated)
}
