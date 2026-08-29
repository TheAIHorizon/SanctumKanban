'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getInitials } from '@/lib/utils'

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

interface Coverage {
  memberCount: number
  totalTasksLogged: number
  covered: {
    code: string
    title: string
    element: string | null
    score: number
    taskCount: number
    contributors: { userId: string; name: string; color: string; taskCount: number }[]
  }[]
  gaps: { code: string; title: string; element: string | null }[]
  perMember: { userId: string; name: string; color: string; taskCount: number; topRole: string | null }[]
}

export function TeamCoverage({ teamId }: { teamId: string }) {
  const [data, setData] = useState<{ team: { name: string }; coverage: Coverage } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/teams/${teamId}/coverage`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Failed to load')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [teamId])

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  if (error || !data) return <div className="p-8 text-destructive">{error || 'No data'}</div>

  const { team, coverage: c } = data
  const totalInScope = c.covered.length + c.gaps.length
  const coveragePct = totalInScope > 0 ? (c.covered.length / totalInScope) * 100 : 0
  const maxScore = Math.max(1, ...c.covered.map((r) => r.score))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Users className="h-6 w-6" />
        <div>
          <h1 className="text-xl font-semibold">{team.name} — Role Coverage</h1>
          <p className="text-sm text-muted-foreground">
            {c.memberCount} members · {c.totalTasksLogged} logged DCWF tasks · covering{' '}
            {c.covered.length}/{totalInScope} course roles ({coveragePct.toFixed(0)}%)
          </p>
        </div>
      </div>

      {/* Covered roles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Roles Covered ({c.covered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {c.covered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No DCWF tasks logged by this team yet.</p>
          ) : (
            <div className="space-y-3">
              {c.covered.map((r) => (
                <div key={r.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span><b>{r.code}</b> {r.title}</span>
                    <span className="text-muted-foreground">{r.taskCount} task{r.taskCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(r.score / maxScore) * 100}%`, backgroundColor: elColor(r.element) }} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.contributors.map((con) => (
                      <span key={con.userId} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="h-4 w-4 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: con.color, fontSize: '7px' }}>
                          {con.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                        </span>
                        {con.name.split(' ')[0]} ({con.taskCount})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Gaps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Coverage Gaps ({c.gaps.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Course-relevant roles with no logged work yet.</p>
          </CardHeader>
          <CardContent>
            {c.gaps.length === 0 ? (
              <p className="text-sm text-green-600">Full coverage — every course role has work logged. 🎉</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {c.gaps.map((g) => (
                  <Badge key={g.code} variant="outline" className="text-[11px]" style={{ borderColor: elColor(g.element) }}>
                    {g.code} {g.title}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-member */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Per-Member Contribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {c.perMember.length === 0 ? (
              <p className="text-sm text-muted-foreground">No member contributions yet.</p>
            ) : (
              c.perMember.map((m) => (
                <Link key={m.userId} href={`/reports/${m.userId}`} className="flex items-center gap-2 hover:bg-muted/40 rounded p-1 -m-1">
                  <span className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ backgroundColor: m.color }}>
                    {m.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                  </span>
                  <span className="text-sm flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.taskCount} task{m.taskCount === 1 ? '' : 's'}
                    {m.topRole ? ` · top ${m.topRole}` : ''}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
