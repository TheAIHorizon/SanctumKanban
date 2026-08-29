import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chat, AiUnavailableError } from '@/lib/ai'

// POST /api/dcwf/suggest  { text, inScopeOnly? }
// Suggest the DCWF Tasks that best match a free-text description of work done.
// Strategy: keyword-prefilter candidates from the DB, then ask a local/OpenAI-
// compatible model to pick the best few. Falls back to keyword ranking when AI
// is unreachable, so suggestions NEVER block ticket logging.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const text: string = (body?.text || '').toString().trim()
    const inScopeOnly: boolean = body?.inScopeOnly !== false // default true
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    // 1) Keyword prefilter: derive salient words, pull candidate Task KSATs.
    const words = Array.from(
      new Set(
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4)
      )
    ).slice(0, 12)

    const roleFilter = inScopeOnly
      ? { roles: { some: { workRole: { inScope: true } } } }
      : {}

    let candidates = await prisma.dcwfKsat.findMany({
      where: {
        type: 'Task',
        ...roleFilter,
        ...(words.length
          ? { OR: words.map((w) => ({ description: { contains: w, mode: 'insensitive' as const } })) }
          : {}),
      },
      take: 40,
      select: {
        id: true,
        ksatId: true,
        description: true,
        roles: {
          select: { coreOrAdditional: true, workRole: { select: { code: true, title: true, inScope: true } } },
        },
      },
    })

    // If keyword prefilter found nothing, widen to any in-scope tasks so the AI
    // still has something to rank (rare).
    if (candidates.length === 0) {
      candidates = await prisma.dcwfKsat.findMany({
        where: { type: 'Task', ...roleFilter },
        take: 40,
        select: {
          id: true,
          ksatId: true,
          description: true,
          roles: {
            select: { coreOrAdditional: true, workRole: { select: { code: true, title: true, inScope: true } } },
          },
        },
      })
    }

    const shape = (t: (typeof candidates)[number]) => ({
      id: t.id,
      ksatId: t.ksatId,
      description: t.description,
      workRoles: t.roles.map((r) => ({
        code: r.workRole.code,
        title: r.workRole.title,
        inScope: r.workRole.inScope,
        coreOrAdditional: r.coreOrAdditional,
      })),
    })

    // 2) Ask the model to pick the best matches, by id.
    let orderedIds: string[] | null = null
    let usedAi = false
    try {
      const list = candidates
        .map((c, i) => `${i + 1}. [${c.id}] (${c.ksatId}) ${c.description}`)
        .join('\n')
      const content = await chat(
        [
          {
            role: 'system',
            content:
              'You map a student\'s description of IT/cybersecurity work to the most relevant DoD Cyber Workforce Framework (DCWF) tasks. ' +
              'Given the work description and a numbered list of candidate tasks, return ONLY a JSON object of the form ' +
              '{"ids": ["<id>", ...]} listing the 3-5 best-matching candidate ids in ranked order. Use only ids from the list.',
          },
          {
            role: 'user',
            content: `WORK DESCRIPTION:\n${text}\n\nCANDIDATE TASKS:\n${list}\n\nReturn the best 3-5 ids as JSON.`,
          },
        ],
        { json: true, temperature: 0.1, maxTokens: 300 }
      )
      usedAi = true
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed?.ids)) {
        const validIds = new Set(candidates.map((c) => c.id))
        orderedIds = parsed.ids.filter((id: unknown) => typeof id === 'string' && validIds.has(id)).slice(0, 5)
      }
    } catch (err) {
      // AI unreachable or bad output — fall back to keyword order below.
      if (!(err instanceof AiUnavailableError)) {
        console.warn('AI suggest parse issue, falling back to keyword ranking:', err)
      }
    }

    // 3) Build the result: AI order if we got it, else keyword prefilter order.
    let tasks
    if (orderedIds && orderedIds.length) {
      const byId = new Map(candidates.map((c) => [c.id, c]))
      tasks = orderedIds.map((id) => shape(byId.get(id)!)).filter(Boolean)
    } else {
      tasks = candidates.slice(0, 5).map(shape)
    }

    return NextResponse.json({ tasks, usedAi, candidateCount: candidates.length })
  } catch (error) {
    console.error('DCWF suggest failed:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
