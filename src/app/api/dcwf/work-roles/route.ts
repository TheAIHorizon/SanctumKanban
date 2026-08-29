import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dcwf/work-roles?inScopeOnly=true&element=<name>
// List DCWF work roles (for report labels, filters, and the in-scope toggle UI).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const inScopeOnly = searchParams.get('inScopeOnly') === 'true'
    const element = searchParams.get('element')

    const where: any = {}
    if (inScopeOnly) where.inScope = true
    if (element) where.element = { name: element }

    const roles = await prisma.dcwfWorkRole.findMany({
      where,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        inScope: true,
        description: true,
        element: { select: { name: true, code: true } },
        _count: { select: { ksats: true } },
      },
    })

    return NextResponse.json(roles)
  } catch (error) {
    console.error('Failed to fetch DCWF work roles:', error)
    return NextResponse.json({ error: 'Failed to fetch DCWF work roles' }, { status: 500 })
  }
}
