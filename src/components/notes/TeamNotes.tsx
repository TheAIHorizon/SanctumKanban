'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { MAX_TEAM_NOTE_LENGTH } from '@/lib/team-notes'

interface TeamNotesProps {
  teamId: string
  canEdit: boolean
  readOnly?: boolean
}

interface NoteResponse {
  content: string
  revision: number
  updatedAt: string | null
}

export function TeamNotes({ teamId, canEdit, readOnly = false }: TeamNotesProps) {
  const { toast } = useToast()
  const [content, setContent] = useState('')
  const [revision, setRevision] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadedTeamId, setLoadedTeamId] = useState<string | null>(null)
  const loadRequest = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current
    setLoading(true)
    setLoadError(false)
    setLoadedTeamId(null)
    setContent('')
    setRevision(0)
    setUpdatedAt(null)
    setConflict(false)
    try {
      const response = await fetch(`/api/teams/${teamId}/note`)
      const body = await response.json().catch(() => ({}))
      if (requestId !== loadRequest.current) return
      if (!response.ok) throw new Error(body.error || 'Could not load team notes')
      const note = body as NoteResponse
      setContent(note.content)
      setRevision(note.revision)
      setUpdatedAt(note.updatedAt)
      setLoadedTeamId(teamId)
    } catch (error) {
      if (requestId !== loadRequest.current) return
      setLoadError(true)
      toast({
        title: 'Could not load team notes',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      if (requestId === loadRequest.current) setLoading(false)
    }
  }, [teamId, toast])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (loadError || loadedTeamId !== teamId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, revision }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setConflict(true)
        toast({ title: 'Newer team notes are available', description: 'Copy your changes if needed, then reload before saving.', variant: 'destructive' })
        return
      }
      if (!response.ok) throw new Error(body.error || 'Could not save team notes')
      const note = body as NoteResponse
      setContent(note.content)
      setRevision(note.revision)
      setUpdatedAt(note.updatedAt)
      setConflict(false)
      toast({ title: 'Team notes saved' })
    } catch (error) {
      toast({
        title: 'Could not save team notes',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || loadedTeamId !== teamId) {
    if (loadError) return (
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Team notes could not be loaded. Editing is disabled.</span>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Retry</Button>
      </div>
    )
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading team notes…</div>
  }

  const editable = canEdit && !readOnly
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Shared workspace: these notes are visible to classmates who can view this class and to observers. They are not private.
      </p>
      {conflict && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Someone else saved a newer version.</span>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Reload</Button>
        </div>
      )}
      <Textarea
        aria-label="Shared team notes"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        readOnly={!editable}
        maxLength={MAX_TEAM_NOTE_LENGTH}
        rows={12}
        placeholder={editable ? 'Share working notes, decisions, and handoffs with your team…' : 'No team notes yet.'}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString()}` : 'Not saved yet'} · {content.length}/{MAX_TEAM_NOTE_LENGTH}</span>
        {editable && (
          <Button size="sm" onClick={save} disabled={saving || conflict}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save notes
          </Button>
        )}
      </div>
    </div>
  )
}
