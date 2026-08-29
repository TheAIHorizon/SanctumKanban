import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeAlignment } from '@/lib/dcwf-alignment'

const ELEMENT_COLORS: Record<string, string> = {
  'IT (Cyberspace)': '#3b82f6',
  Cybersecurity: '#ef4444',
  'Cyber Effects': '#8b5cf6',
  'Intel (Cyber)': '#f59e0b',
  'Cyber Enablers': '#14b8a6',
  'Data/AI': '#ec4899',
  'Software Engineering': '#84cc16',
  Unassigned: '#9ca3af',
}
const elColor = (n: string | null) => (n && ELEMENT_COLORS[n]) || '#9ca3af'
const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// GET /api/users/[id]/report/export?inScopeOnly=true
// Returns a self-contained HTML report as a downloadable file.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const targetId = params.id
    if (session.user.role === 'OBSERVER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const isSelf = session.user.id === targetId
    const isAdmin = session.user.role === 'ADMIN'
    let isLeadOfTarget = false
    if (!isSelf && !isAdmin) {
      const leadTeams = await prisma.teamMember.findMany({
        where: { userId: session.user.id, role: 'LEAD' },
        select: { teamId: true },
      })
      if (leadTeams.length) {
        const shared = await prisma.teamMember.findFirst({
          where: { userId: targetId, teamId: { in: leadTeams.map((t) => t.teamId) } },
        })
        isLeadOfTarget = Boolean(shared)
      }
    }
    if (!isSelf && !isAdmin && !isLeadOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const inScopeOnly = searchParams.get('inScopeOnly') === 'true'

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        color: true,
        role: true,
        teamMemberships: { select: { role: true, team: { select: { name: true } } } },
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const taskLinks = await prisma.ticketDcwfTask.findMany({
      where: { createdById: targetId },
      orderBy: { createdAt: 'desc' },
      select: {
        note: true,
        createdAt: true,
        ticket: { select: { title: true, team: { select: { name: true } } } },
        ksat: {
          select: {
            ksatId: true,
            description: true,
            roles: {
              select: { coreOrAdditional: true, workRole: { select: { code: true, title: true, inScope: true } } },
            },
          },
        },
      },
    })

    const alignment = await computeAlignment({ userId: targetId, inScopeOnly })

    const initials = (user.firstName[0] + user.lastName[0]).toUpperCase()
    const top = alignment.roles[0]
    const generated = new Date().toLocaleString()

    const roleBars = alignment.roles
      .map(
        (r) => `
      <div class="bar-row">
        <div class="bar-label"><span><b>${esc(r.code)}</b> ${esc(r.title)}${r.inScope ? '' : ' · other'}${r.coreCount ? ` · ${r.coreCount} core` : ''}</span><span class="pct">${r.percent.toFixed(0)}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(r.percent, 2).toFixed(0)}%;background:${elColor(r.element)}"></div></div>
      </div>`
      )
      .join('')

    const elSeg = alignment.elements
      .map((e) => `<div style="width:${e.percent}%;background:${elColor(e.name)}" title="${esc(e.name)}"></div>`)
      .join('')
    const elLegend = alignment.elements
      .map(
        (e) =>
          `<span class="legend"><span class="dot" style="background:${elColor(e.name)}"></span>${esc(e.name)} ${e.percent.toFixed(0)}%</span>`
      )
      .join('')

    const taskLog = taskLinks
      .map((l) => {
        const roles = l.ksat.roles
        const role = roles.find((r) => r.workRole.inScope) || roles[0]
        const rl = role ? `${role.workRole.code} ${role.workRole.title}${role.coreOrAdditional ? ` · ${role.coreOrAdditional}` : ''}` : ''
        const note = l.note ? `<div class="note">“${esc(l.note)}”</div>` : ''
        return `
      <div class="task">
        <div class="task-head"><span class="chip">${esc(l.ksat.ksatId)}</span><span class="role">${esc(rl)}</span></div>
        <div class="task-desc">${esc(l.ksat.description)}</div>
        ${note}
        <div class="task-meta">${esc(l.ticket?.title || 'ticket removed')}${l.ticket?.team ? ' · ' + esc(l.ticket.team.name) : ''} · ${new Date(l.createdAt).toLocaleDateString()}</div>
      </div>`
      })
      .join('')

    const teams = user.teamMemberships.map((m) => `<span class="tag">${esc(m.team.name)}</span>`).join(' ')

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>DCWF Report — ${esc(user.firstName)} ${esc(user.lastName)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px;line-height:1.4}
  .wrap{max-width:900px;margin:0 auto}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin-bottom:18px}
  h1{font-size:20px;margin:0}
  .muted{color:#64748b;font-size:13px}
  .title{font-size:15px;font-weight:600;margin-bottom:10px}
  .head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
  .avatar{width:48px;height:48px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;flex-shrink:0}
  .tag{background:#f1f5f9;border-radius:4px;padding:1px 8px;font-size:11px}
  .badge{border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px;font-size:10px}
  .bar-row{margin-bottom:8px}
  .bar-label{display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;gap:8px}
  .bar-label span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pct{color:#64748b;flex-shrink:0}
  .bar-track{height:10px;border-radius:5px;background:#e5e7eb;overflow:hidden}
  .bar-fill{height:100%;border-radius:5px}
  .elbar{height:12px;border-radius:6px;overflow:hidden;display:flex;margin-top:4px}
  .legend{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#64748b;margin-right:12px}
  .dot{width:8px;height:8px;border-radius:50%}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:700px){.grid{grid-template-columns:1fr}}
  .task{border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:8px}
  .task-head{display:flex;gap:6px;align-items:center}
  .chip{background:#f1f5f9;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600}
  .role{font-size:10px;color:#64748b}
  .task-desc{font-size:12px;margin-top:4px}
  .note{font-size:11px;color:#475569;font-style:italic;border-left:2px solid #cbd5e1;padding-left:8px;margin-top:4px}
  .task-meta{font-size:10px;color:#94a3b8;margin-top:4px}
  @media print{body{background:#fff;padding:0}.card{break-inside:avoid}}
</style></head><body><div class="wrap">
  <div class="head">
    <div class="avatar" style="background:${esc(user.color)}">${esc(initials)}</div>
    <div>
      <h1>${esc(user.firstName)} ${esc(user.lastName)}</h1>
      <div class="muted">${esc(user.email)} &nbsp; <span class="badge">${esc(user.role)}</span> ${teams}</div>
    </div>
  </div>

  <div class="card">
    <div class="title">🎯 Work-Role Alignment</div>
    <div class="muted" style="margin-bottom:14px">Based on ${alignment.totalTasksLogged} logged DCWF task${alignment.totalTasksLogged === 1 ? '' : 's'}.${top ? ` Strongest fit: <b>${esc(top.code)} ${esc(top.title)}</b> (${top.percent.toFixed(0)}%).` : ''}</div>
    ${alignment.roles.length ? roleBars : '<div class="muted">No DCWF tasks logged yet.</div>'}
    ${alignment.elements.length ? `<div style="margin-top:16px"><div class="muted">By DCWF Element</div><div class="elbar">${elSeg}</div><div style="margin-top:8px">${elLegend}</div></div>` : ''}
  </div>

  <div class="card">
    <div class="title">📋 DCWF Task Log (${taskLinks.length})</div>
    ${taskLinks.length ? taskLog : '<div class="muted">No tasks logged yet.</div>'}
  </div>

  <div class="muted" style="text-align:center">Sanctum Kanban — DCWF alignment report · generated ${esc(generated)}</div>
</div></body></html>`

    const filename = `dcwf-report-${user.lastName}-${user.firstName}.html`.replace(/[^a-zA-Z0-9._-]/g, '_')
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Failed to export report:', error)
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  }
}
