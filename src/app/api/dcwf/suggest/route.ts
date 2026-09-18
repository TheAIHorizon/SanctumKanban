import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { chat } from '@/lib/ai'
import { authOptions } from '@/lib/auth'
import {
  authorizeDcwfSuggestion,
  generateAdvice,
  rankDcwfTasks,
  type DcwfCandidate,
} from '@/lib/dcwf-suggest'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/permissions'

const coachModel = process.env.AI_COACH_MODEL || 'laguna-s'
const RATE_WINDOW_MS = 60_000
const RATE_MAX_REQUESTS = 4
const RATE_COOLDOWN_MS = 3_000
const RATE_USER_LIMIT = 500
const recentRequests = new Map<string, number[]>()

function takeRateSlot(userId: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const recent = (recentRequests.get(userId) || []).filter((time) => now - time < RATE_WINDOW_MS)
  const last = recent[recent.length - 1]
  if ((last != null && now - last < RATE_COOLDOWN_MS) || recent.length >= RATE_MAX_REQUESTS) {
    const waitMs = last != null && now - last < RATE_COOLDOWN_MS
      ? RATE_COOLDOWN_MS - (now - last)
      : RATE_WINDOW_MS - (now - recent[0])
    recentRequests.set(userId, recent)
    return { ok: false, retryAfter: Math.max(1, Math.ceil(waitMs / 1000)) }
  }

  recent.push(now)
  recentRequests.set(userId, recent)
  if (recentRequests.size > RATE_USER_LIMIT) {
    for (const storedUser of Array.from(recentRequests.keys())) {
      if (storedUser !== userId) {
        recentRequests.delete(storedUser)
        break
      }
    }
  }
  return { ok: true }
}

// POST /api/dcwf/suggest { ticketId, text, inScopeOnly? }
// `text` may contain unsaved draft text. No ticket or DCWF records are written.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role === 'OBSERVER') {
      return NextResponse.json({ error: 'Observers cannot request DCWF coaching' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const input = body as { ticketId?: unknown; text?: unknown; inScopeOnly?: unknown }
    const ticketId = typeof input?.ticketId === 'string' ? input.ticketId.trim() : ''
    const text = typeof input?.text === 'string' ? input.text.trim() : ''
    const inScopeOnly = input?.inScopeOnly !== false
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    }
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.length > 12_000) {
      return NextResponse.json({ error: 'text must be 12000 characters or fewer' }, { status: 400 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        teamId: true,
        assigneeId: true,
        createdById: true,
        archived: true,
        team: {
          select: {
            members: {
              where: { userId: session.user.id },
              select: { role: true },
            },
            classWorkspace: { select: { archivedAt: true } },
          },
        },
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const authorization = authorizeDcwfSuggestion(
      { id: session.user.id, role: session.user.role as Role },
      {
        ticketId: ticket.id,
        teamId: ticket.teamId,
        archived: ticket.archived,
        classArchived: Boolean(ticket.team.classWorkspace?.archivedAt),
        assigneeId: ticket.assigneeId,
        createdById: ticket.createdById,
        membershipRole: ticket.team.members[0]?.role || null,
      }
    )
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status })
    }

    const rate = takeRateSlot(session.user.id)
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'Please wait before requesting more coaching suggestions' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const roleFilter = inScopeOnly
      ? { roles: { some: { workRole: { inScope: true } } } }
      : {}
    const rows = await prisma.dcwfKsat.findMany({
      where: { type: 'Task', ...roleFilter },
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
    const importedTasks: DcwfCandidate[] = rows.map((row) => ({
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
    const candidates = rankDcwfTasks(text, importedTasks, 20)

    const generated = await generateAdvice(text, candidates, chat, coachModel)

    return NextResponse.json({
      guidance: generated.advice.guidance,
      tasks: generated.advice.tasks,
      usedAi: generated.advice.usedAi,
      candidateCount: candidates.length,
      mode: generated.advice.mode,
      fallbackReason: generated.fallbackReason,
      model: generated.model,
    })
  } catch {
    // Deliberately do not log prompts, student text, credentials, or model payloads.
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
