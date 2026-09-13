'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  MAX_DELIVERABLES,
  MAX_DELIVERABLE_DESCRIPTION_LENGTH,
  MAX_DELIVERABLE_TITLE_LENGTH,
  type DeliverableKind,
} from '@/lib/deliverables'

interface DeliverableRow {
  id: number
  title: string
  description: string
  kind: DeliverableKind
}

interface WorkspaceSummary {
  name: string
  archivedAt: string | null
  teams: Array<{ id: string; name: string }>
}

interface DistributionResult {
  created: number
  skipped: number
  teams: number
  deliverables: number
}

export function DeliverablesDistributor({ classId }: { classId: string }) {
  const { toast } = useToast()
  const nextId = useRef(2)
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<DistributionResult | null>(null)
  const [rows, setRows] = useState<DeliverableRow[]>([
    { id: 1, title: '', description: '', kind: 'required' },
  ])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/classes/${encodeURIComponent(classId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || 'Could not load class')
        return response.json()
      })
      .then((data) => { if (!cancelled) setWorkspace(data) })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load class') })
    return () => { cancelled = true }
  }, [classId])

  const updateRow = (id: number, patch: Partial<DeliverableRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
    setResult(null)
  }

  const addRow = () => {
    if (rows.length >= MAX_DELIVERABLES) return
    setRows((current) => [...current, { id: nextId.current++, title: '', description: '', kind: 'required' }])
  }

  const removeRow = (id: number) => {
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id))
    setResult(null)
  }

  const distribute = async () => {
    if (!workspace || workspace.archivedAt || workspace.teams.length === 0) return
    const incomplete = rows.some((row) => !row.title.trim())
    if (incomplete) {
      toast({ title: 'Every deliverable needs a title', variant: 'destructive' })
      return
    }
    const ticketTotal = rows.length * workspace.teams.length
    if (!window.confirm(`Distribute ${rows.length} deliverable${rows.length === 1 ? '' : 's'} across ${workspace.teams.length} teams? Up to ${ticketTotal} new backlog tickets will be appended.`)) return

    setSubmitting(true)
    setResult(null)
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverables: rows.map(({ title, description, kind }) => ({ title, description, kind })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Distribution failed')
      setResult(data)
      toast({
        title: 'Deliverables distributed',
        description: `${data.created} created; ${data.skipped} already present and skipped.`,
      })
    } catch (error) {
      toast({
        title: 'Could not distribute deliverables',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return <div className="container mx-auto max-w-4xl p-6 text-destructive">{loadError}</div>
  }
  if (!workspace) {
    return <div className="container mx-auto max-w-4xl p-6 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading class…</div>
  }

  const disabled = submitting || !!workspace.archivedAt || workspace.teams.length === 0

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <Link href="/admin/classes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="mr-1 h-4 w-4" />Classes
        </Link>
        <h1 className="text-2xl font-bold">Shared deliverables</h1>
        <p className="text-muted-foreground">
          {workspace.name} · {workspace.teams.length} team{workspace.teams.length === 1 ? '' : 's'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instructor requirements</CardTitle>
          <CardDescription>
            Each row becomes the same unassigned backlog ticket on every team board. Required work receives the Required tag; optional stretch work receives Bonus / Extra. Existing student tickets are never changed or removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {workspace.archivedAt && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">This class is archived and read-only. Restore it before distributing work.</p>
          )}
          {workspace.teams.length === 0 && (
            <p className="rounded-md border p-3 text-sm text-muted-foreground">Add team boards to this class before distributing deliverables.</p>
          )}

          {rows.map((row, index) => (
            <div key={row.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">Deliverable {index + 1}</h2>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove deliverable ${index + 1}`} disabled={rows.length === 1 || submitting} onClick={() => removeRow(row.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor={`deliverable-title-${row.id}`}>Ticket title</Label>
                  <Input id={`deliverable-title-${row.id}`} maxLength={MAX_DELIVERABLE_TITLE_LENGTH} value={row.title} disabled={submitting} onChange={(event) => updateRow(row.id, { title: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`deliverable-kind-${row.id}`}>Work type</Label>
                  <select id={`deliverable-kind-${row.id}`} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={row.kind} disabled={submitting} onChange={(event) => updateRow(row.id, { kind: event.target.value as DeliverableKind })}>
                    <option value="required">Required</option>
                    <option value="bonus">Bonus / Extra</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`deliverable-description-${row.id}`}>Description (optional)</Label>
                <Textarea id={`deliverable-description-${row.id}`} maxLength={MAX_DELIVERABLE_DESCRIPTION_LENGTH} value={row.description} disabled={submitting} onChange={(event) => updateRow(row.id, { description: event.target.value })} />
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" disabled={submitting || rows.length >= MAX_DELIVERABLES} onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" />Add deliverable
            </Button>
            <Button type="button" disabled={disabled} onClick={distribute}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Distribute to all teams
            </Button>
          </div>

          {result && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm" role="status">
              <strong>{result.created} tickets created.</strong> {result.skipped} matching tagged tickets already existed and were skipped across {result.teams} teams.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
