import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkTicketPermission } from '@/lib/ticket-permissions'

// GET /api/tickets/[id]/dcwf-tasks
// List the DCWF task links (with reflection notes) for a ticket.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const links = await prisma.ticketDcwfTask.findMany({
      where: { ticketId: params.id },
      orderBy: { createdAt: 'asc' },
      include: {
        ksat: {
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
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json(links)
  } catch (error) {
    console.error('Failed to fetch ticket DCWF tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch DCWF tasks' }, { status: 500 })
  }
}

// POST /api/tickets/[id]/dcwf-tasks  { ksatId, note? }
// Link a DCWF Task to the ticket (with optional reflection note).
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const perm = await checkTicketPermission(params.id, session.user.id, session.user.role)
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status })
    }

    const body = await request.json()
    const { ksatId, note } = body as { ksatId?: string; note?: string }

    if (!ksatId) {
      return NextResponse.json({ error: 'ksatId is required' }, { status: 400 })
    }

    // Enforce that the linked KSAT exists and is a Task.
    const ksat = await prisma.dcwfKsat.findUnique({ where: { id: ksatId } })
    if (!ksat) {
      return NextResponse.json({ error: 'DCWF KSAT not found' }, { status: 404 })
    }
    if (ksat.type !== 'Task') {
      return NextResponse.json(
        { error: `Only DCWF Tasks can be linked (got type "${ksat.type}")` },
        { status: 400 }
      )
    }

    // Upsert so re-linking the same task just updates the note instead of erroring.
    const link = await prisma.ticketDcwfTask.upsert({
      where: { ticketId_ksatId: { ticketId: params.id, ksatId } },
      update: { note: note ?? null },
      create: {
        ticketId: params.id,
        ksatId,
        note: note ?? null,
        createdById: session.user.id,
      },
      include: {
        ksat: { select: { id: true, ksatId: true, description: true } },
      },
    })

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    console.error('Failed to link DCWF task:', error)
    return NextResponse.json({ error: 'Failed to link DCWF task' }, { status: 500 })
  }
}
