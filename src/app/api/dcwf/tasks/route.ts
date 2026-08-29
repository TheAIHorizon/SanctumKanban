import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dcwf/tasks?q=<text>&limit=20&inScopeOnly=true
// Search DCWF Task-type KSATs by description or framework id.
// Only returns type="Task" KSATs (the linkable ones).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 20 : limitRaw, 1), 50)
    const inScopeOnly = searchParams.get('inScopeOnly') === 'true'

    // Base filter: Task type only.
    const where: any = { type: 'Task' }

    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { ksatId: { contains: q, mode: 'insensitive' } },
      ]
    }

    // If restricting to in-scope roles, only include tasks that belong to at
    // least one in-scope work role.
    if (inScopeOnly) {
      where.roles = { some: { workRole: { inScope: true } } }
    }

    const tasks = await prisma.dcwfKsat.findMany({
      where,
      take: limit,
      orderBy: { ksatId: 'asc' },
      select: {
        id: true,
        ksatId: true,
        description: true,
        // include the work roles this task maps to (for context in the picker)
        roles: {
          select: {
            coreOrAdditional: true,
            workRole: { select: { code: true, title: true, inScope: true } },
          },
        },
      },
    })

    // Flatten role info for convenient client display.
    const result = tasks.map((t) => ({
      id: t.id,
      ksatId: t.ksatId,
      description: t.description,
      workRoles: t.roles.map((r) => ({
        code: r.workRole.code,
        title: r.workRole.title,
        inScope: r.workRole.inScope,
        coreOrAdditional: r.coreOrAdditional,
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to search DCWF tasks:', error)
    return NextResponse.json({ error: 'Failed to search DCWF tasks' }, { status: 500 })
  }
}
