'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Target, ChevronRight } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface UserItem {
  id: string
  firstName: string
  lastName: string
  email: string
  color: string
  role: string
  teamMemberships?: { role: string; team: { id: string; name: string; classWorkspaceId: string | null } }[]
}

export default function ReportsIndexPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string; term: string | null }[]>([])
  const [classId, setClassId] = useState('')
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/classes').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([u, c]) => {
        setUsers(Array.isArray(u) ? u : u.users || [])
        const list = Array.isArray(c) ? c : []
        setClasses(list)
        setClassId(list[0]?.id || '')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) { setTeams([]); return }
    fetch(`/api/teams?classId=${encodeURIComponent(classId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((t) => setTeams(Array.isArray(t) ? t : t.teams || []))
  }, [classId])

  const filtered = users.filter((u) => {
    const inClass = u.teamMemberships?.some((m) => m.team.classWorkspaceId === classId)
    if (!inClass) return false
    const s = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase()
    return s.includes(q.toLowerCase())
  })

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Target className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Student Reports</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Select a student to see their activity timeline, logged DCWF tasks, and
        work-role alignment.
      </p>

      <div className="mb-4">
        <label className="text-xs font-medium text-muted-foreground">Class workspace</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
          {classes.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>{workspace.name}{workspace.term ? ` · ${workspace.term}` : ''}</option>
          ))}
        </select>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Team coverage shortcuts */}
          {teams.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-medium text-muted-foreground mb-2">Team role coverage</div>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <Link key={t.id} href={`/reports/team/${t.id}`}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted text-xs py-1 px-2.5">
                      {t.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs font-medium text-muted-foreground mb-2">Students</div>
          <div className="space-y-2">
          {filtered.map((u) => (
            <Link key={u.id} href={`/reports/${u.id}`}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 p-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: u.color, color: '#fff' }}
                  >
                    {getInitials(u.firstName, u.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{u.email}</span>
                      {u.teamMemberships?.slice(0, 2).map((m) => (
                        <Badge key={m.team.id} variant="secondary" className="text-[10px]">
                          {m.team.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No students match “{q}”.</p>
          )}
          </div>
        </>
      )}
    </div>
  )
}
