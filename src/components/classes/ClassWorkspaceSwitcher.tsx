'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Archive, BookOpen, LockKeyhole, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClassOption {
  id: string
  name: string
  code: string | null
  term: string | null
  archivedAt: Date | string | null
  _count: { teams: number }
}

export function ClassWorkspaceSwitcher({
  classes,
  selectedId,
  archived,
  canManage,
}: {
  classes: ClassOption[]
  selectedId: string | null
  archived: boolean
  canManage: boolean
}) {
  const router = useRouter()
  const search = useSearchParams()

  const navigate = (classId: string, nextArchived = archived) => {
    const params = new URLSearchParams(search.toString())
    if (classId) params.set('classId', classId)
    else params.delete('classId')
    if (nextArchived) params.set('archived', '1')
    else params.delete('archived')
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-md bg-primary/10 p-2">
          {archived ? <Archive className="h-5 w-5 text-primary" /> : <BookOpen className="h-5 w-5 text-primary" />}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {archived ? 'Archived classes · read only' : 'Class workspace'}
          </div>
          <select
            aria-label="Select class workspace"
            value={selectedId || ''}
            onChange={(event) => navigate(event.target.value)}
            className="mt-1 max-w-full rounded-md border bg-background px-3 py-1.5 text-sm font-medium"
          >
            {!classes.length && <option value="">No {archived ? 'archived' : 'active'} classes</option>}
            {classes.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}{workspace.term ? ` · ${workspace.term}` : ''} ({workspace._count.teams} teams)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {archived && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            <LockKeyhole className="h-3.5 w-3.5" /> Read only
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate('', !archived)}>
          {archived ? <BookOpen className="mr-1 h-4 w-4" /> : <Archive className="mr-1 h-4 w-4" />}
          {archived ? 'Active classes' : 'Archived classes'}
        </Button>
        {canManage && (
          <Link href="/admin/classes">
            <Button variant="outline" size="sm"><Settings className="mr-1 h-4 w-4" />Manage classes</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
