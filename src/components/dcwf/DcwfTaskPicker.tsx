'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Search, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface WorkRoleRef {
  code: string
  title: string
  inScope: boolean
  coreOrAdditional: string | null
}

interface DcwfTask {
  id: string
  ksatId: string
  description: string
  workRoles: WorkRoleRef[]
}

interface TaskLink {
  id: string
  ksatId: string // link id fields
  note: string | null
  ksat: {
    id: string
    ksatId: string
    description: string
    roles?: { coreOrAdditional: string | null; workRole: WorkRoleRef }[]
  }
}

interface DcwfTaskPickerProps {
  ticketId: string
  // Optional seed text (ticket title/description) for AI suggestions
  suggestText?: string
}

// Renders the linked-task list + a search/AI picker. Persists directly via the
// ticket DCWF-task API so it works whenever a ticket already exists (Edit dialog).
export function DcwfTaskPicker({ ticketId, suggestText }: DcwfTaskPickerProps) {
  const [links, setLinks] = useState<TaskLink[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DcwfTask[]>([])
  const [searching, setSearching] = useState(false)
  const [inScopeOnly, setInScopeOnly] = useState(true)
  const [suggesting, setSuggesting] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const loadLinks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/dcwf-tasks`)
      if (res.ok) setLinks(await res.json())
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/dcwf/tasks?q=${encodeURIComponent(query)}&limit=15&inScopeOnly=${inScopeOnly}`
        )
        if (res.ok) setResults(await res.json())
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, inScopeOnly])

  const linkedIds = new Set(links.map((l) => l.ksat.id))

  async function addTask(task: DcwfTask) {
    const res = await fetch(`/api/tickets/${ticketId}/dcwf-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ksatId: task.id }),
    })
    if (res.ok) {
      setQuery('')
      setResults([])
      await loadLinks()
    }
  }

  async function removeLink(linkId: string) {
    const res = await fetch(`/api/ticket-dcwf-tasks/${linkId}`, { method: 'DELETE' })
    if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== linkId))
  }

  async function saveNote(linkId: string, note: string) {
    await fetch(`/api/ticket-dcwf-tasks/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
  }

  async function suggest() {
    if (!suggestText?.trim()) return
    setSuggesting(true)
    try {
      const res = await fetch('/api/dcwf/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: suggestText, inScopeOnly }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data.tasks || [])
      }
    } finally {
      setSuggesting(false)
    }
  }

  function primaryRole(task: { workRoles?: WorkRoleRef[]; roles?: any[] } | DcwfTask): WorkRoleRef | null {
    const wr = (task as DcwfTask).workRoles
    if (wr && wr.length) {
      // prefer an in-scope Core role
      return (
        wr.find((r) => r.inScope && r.coreOrAdditional === 'Core') ||
        wr.find((r) => r.inScope) ||
        wr[0]
      )
    }
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">DCWF Tasks</Label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={inScopeOnly}
            onChange={(e) => setInScopeOnly(e.target.checked)}
            className="h-3 w-3"
          />
          Course roles only
        </label>
      </div>

      {/* Linked tasks */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No DCWF tasks linked yet. Search below (or use ✨ Suggest) to align this
          ticket to the framework.
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const role = link.ksat.roles?.length
              ? link.ksat.roles.find((r) => r.workRole.inScope) || link.ksat.roles[0]
              : null
            const isOpen = expanded[link.id]
            return (
              <div key={link.id} className="rounded-md border p-2 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {link.ksat.ksatId}
                      </Badge>
                      {role && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {role.workRole.code} {role.workRole.title}
                          {role.coreOrAdditional ? ` · ${role.coreOrAdditional}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 line-clamp-2">{link.ksat.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [link.id]: !isOpen }))}
                      className="text-muted-foreground hover:text-foreground"
                      title={isOpen ? 'Hide note' : 'Add/edit note'}
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLink(link.id)}
                      className="text-destructive hover:text-destructive/80"
                      title="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <Textarea
                    defaultValue={link.note || ''}
                    placeholder="What did you do for this task? (reflection)"
                    className="text-xs min-h-[60px]"
                    onBlur={(e) => saveNote(link.id, e.target.value)}
                  />
                )}
                {!isOpen && link.note && (
                  <p className="text-[11px] text-muted-foreground italic line-clamp-1">
                    “{link.note}”
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Search + suggest */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search DCWF tasks…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          {suggestText && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={suggest}
              disabled={suggesting}
              className="h-8 shrink-0"
              title="Suggest DCWF tasks from the ticket text (local AI)"
            >
              {suggesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 hidden sm:inline">Suggest</span>
            </Button>
          )}
        </div>

        {searching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Searching…
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
            {results.map((task) => {
              const role = primaryRole(task)
              const already = linkedIds.has(task.id)
              return (
                <button
                  key={task.id}
                  type="button"
                  disabled={already}
                  onClick={() => addTask(task)}
                  className="w-full text-left p-2 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-start gap-2"
                >
                  <Plus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {task.ksatId}
                      </Badge>
                      {role && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {role.code} {role.title}
                          {role.inScope ? '' : ' · (other)'}
                        </span>
                      )}
                      {already && <span className="text-[10px] text-green-600">linked</span>}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-2">{task.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Local Label (avoid extra import churn)
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={className}>{children}</span>
}
