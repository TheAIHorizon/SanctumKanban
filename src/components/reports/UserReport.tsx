'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Target, Activity, ClipboardList, ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime, getInitials } from '@/lib/utils'

// Stable colors per DCWF element (fallbacks to gray)
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
const elColor = (name: string | null) => (name && ELEMENT_COLORS[name]) || '#9ca3af'

interface ReportData {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    color: string
    role: string
    teamMemberships: { role: string; team: { id: string; name: string } }[]
  }
  timeline: {
    id: string
    action: string
    fromStatus: string | null
    toStatus: string | null
    timestamp: string
    ticket: { id: string; title: string; team: { id: string; name: string } | null } | null
  }[]
  taskLinks: {
    id: string
    note: string | null
    createdAt: string
    ticket: { id: string; title: string; team: { name: string } | null } | null
    ksat: {
      ksatId: string
      description: string
      roles: { coreOrAdditional: string | null; workRole: { code: string; title: string; inScope: boolean } }[]
    }
  }[]
  alignment: {
    totalTasksLogged: number
    totalScore: number
    roles: {
      code: string
      title: string
      element: string | null
      inScope: boolean
      score: number
      percent: number
      taskCount: number
      coreCount: number
    }[]
    elements: { name: string; score: number; percent: number; roleCount: number }[]
  }
}

export function UserReport({ userId }: { userId: string }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [inScopeOnly, setInScopeOnly] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/users/${userId}/report?inScopeOnly=${inScopeOnly}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load report')
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, inScopeOnly])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
      </div>
    )
  }
  if (error || !data) {
    return <div className="p-8 text-destructive">{error || 'No data'}</div>
  }

  const { user, alignment, taskLinks, timeline } = data
  const topRole = alignment.roles[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center font-semibold text-sm"
          style={{ backgroundColor: user.color, color: '#fff' }}
        >
          {getInitials(user.firstName, user.lastName)}
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            {user.firstName} {user.lastName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{user.email}</span>
            <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
            {user.teamMemberships.map((m) => (
              <Badge key={m.team.id} variant="secondary" className="text-[10px]">
                {m.team.name}
              </Badge>
            ))}
          </div>
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={inScopeOnly} onChange={(e) => setInScopeOnly(e.target.checked)} className="h-3 w-3" />
          Course roles only
        </label>
        <a
          href={`/api/users/${userId}/report/export?inScopeOnly=${inScopeOnly}`}
          className="inline-flex items-center gap-1 text-xs border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors"
          title="Download this report as a self-contained HTML file"
        >
          <Download className="h-3.5 w-3.5" /> Export HTML
        </a>
      </div>

      {/* Alignment — the centerpiece */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Work-Role Alignment
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Based on {alignment.totalTasksLogged} logged DCWF task
            {alignment.totalTasksLogged === 1 ? '' : 's'}.
            {topRole && (
              <> Strongest fit: <span className="font-medium text-foreground">{topRole.code} {topRole.title}</span> ({topRole.percent.toFixed(0)}%).</>
            )}
          </p>
        </CardHeader>
        <CardContent>
          {alignment.roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No DCWF tasks logged yet. As this student links tasks to their
              tickets, their role alignment will appear here.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Ranked role bars */}
              <div className="space-y-2">
                {alignment.roles.slice(0, 12).map((r) => (
                  <div key={r.code} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">
                        <span className="font-medium">{r.code}</span> {r.title}
                        {!r.inScope && <span className="text-muted-foreground"> · other</span>}
                        {r.coreCount > 0 && (
                          <span className="text-muted-foreground"> · {r.coreCount} core</span>
                        )}
                      </span>
                      <span className="text-muted-foreground shrink-0 ml-2">{r.percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(r.percent, 2)}%`, backgroundColor: elColor(r.element) }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Element rollup */}
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">By DCWF Element</div>
                <div className="h-3 rounded-full overflow-hidden flex">
                  {alignment.elements.map((e) => (
                    <div
                      key={e.name}
                      className="h-full"
                      style={{ width: `${e.percent}%`, backgroundColor: elColor(e.name) }}
                      title={`${e.name}: ${e.percent.toFixed(0)}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {alignment.elements.map((e) => (
                    <div key={e.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: elColor(e.name) }} />
                      {e.name} {e.percent.toFixed(0)}%
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task log with reflections */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> DCWF Task Log ({taskLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[420px] overflow-auto">
            {taskLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks logged yet.</p>
            ) : (
              taskLinks.map((l) => {
                const role = l.ksat.roles.find((r) => r.workRole.inScope) || l.ksat.roles[0]
                return (
                  <div key={l.id} className="rounded-md border p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{l.ksat.ksatId}</Badge>
                      {role && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {role.workRole.code} {role.workRole.title}
                          {role.coreOrAdditional ? ` · ${role.coreOrAdditional}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs">{l.ksat.description}</p>
                    {l.note && (
                      <p className="text-[11px] text-muted-foreground italic border-l-2 pl-2 mt-1">
                        “{l.note}”
                      </p>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {l.ticket ? `${l.ticket.title}` : 'ticket removed'}
                      {l.ticket?.team ? ` · ${l.ticket.team.name}` : ''} · {formatDateTime(l.createdAt)}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Activity timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-auto">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
            ) : (
              <ol className="relative border-l pl-4 space-y-3">
                {timeline.map((ev) => (
                  <li key={ev.id} className="text-xs">
                    <div className="absolute -left-[5px] h-2 w-2 rounded-full bg-primary" />
                    <div className="font-medium">
                      {ev.action}
                      {ev.fromStatus && ev.toStatus && (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          {ev.fromStatus} → {ev.toStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {ev.ticket?.title || 'ticket'}
                      {ev.ticket?.team ? ` · ${ev.ticket.team.name}` : ''}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatDateTime(ev.timestamp)}</div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
