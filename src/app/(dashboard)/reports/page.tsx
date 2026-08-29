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
  teamMemberships?: { role: string; team: { id: string; name: string } }[]
}

export default function ReportsIndexPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUsers(Array.isArray(d) ? d : d.users || []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter((u) => {
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
      )}
    </div>
  )
}
