import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/cohort/guard'
import { parseSurveyCsv } from '@/lib/cohort/csv'

// GET /api/cohorts  — list cohorts (admin)
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cohorts = await prisma.cohort.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      classWorkspace: { select: { id: true, name: true, archivedAt: true } },
      _count: { select: { responses: true, runs: true } },
    },
  })
  return NextResponse.json({ cohorts })
}

// POST /api/cohorts  — create a cohort, optionally importing a CSV in one shot.
// Body: { name, term?, teamSize?, csv? }
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, term, teamSize, csv, classWorkspaceId } = body
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const workspace = classWorkspaceId
    ? await prisma.classWorkspace.findFirst({ where: { id: classWorkspaceId, archivedAt: null } })
    : await prisma.classWorkspace.findFirst({ where: { archivedAt: null }, orderBy: { createdAt: 'desc' } })
  if (!workspace) return NextResponse.json({ error: 'An active class workspace is required' }, { status: 400 })

  const cohort = await prisma.cohort.create({
    data: {
      name,
      term: term || null,
      teamSize: teamSize && teamSize >= 2 ? teamSize : 3,
      createdById: (session.user as any).id,
      classWorkspaceId: workspace.id,
    },
  })

  let imported = 0
  if (typeof csv === 'string' && csv.trim()) {
    const rows = parseSurveyCsv(csv)
    if (rows.length) {
      await prisma.surveyResponse.createMany({
        data: rows.map((r) => ({
          cohortId: cohort.id,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          skills: r.skills,
          depthNote: r.depthNote || null,
          aspirationRole: r.aspirationRole || null,
          leadership: r.leadership || null,
          availDays: r.availDays,
          timePref: r.timePref || null,
          workStyle: r.workStyle || null,
          partnerRequest: r.partnerRequest || null,
          antiPartner: r.antiPartner || null,
          constraints: r.constraints || null,
        })),
      })
      imported = rows.length
    }
  }

  return NextResponse.json({ cohort, imported }, { status: 201 })
}
