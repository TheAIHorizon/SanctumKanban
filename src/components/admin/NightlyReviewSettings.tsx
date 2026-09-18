'use client'
import { formatRunSummary, hasPendingReview } from '@/lib/nightly-review-ui'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Clock, Loader2, Play, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { defaultNightlyReviewSettings, validateNightlyReviewDraft } from '@/lib/nightly-review-settings'

interface NightlyReviewState {
  enabled: boolean
  hour: number
  timeZone: string
  lastRunAt: string | null
  lastRunDate: string | null
  lastError: string | null
  lastSummary: string | null
  pending: boolean
}

interface NightlyReviewSettingsProps { classId: string; isArchived: boolean }

const defaults: NightlyReviewState = {
  ...defaultNightlyReviewSettings(), lastRunAt: null, lastRunDate: null, lastError: null, lastSummary: null, pending: false,
}

function readSettings(data: Record<string, unknown> | { settings: Record<string, unknown> }): NightlyReviewState {
  const raw: Record<string, unknown> = ('settings' in data && data.settings ? data.settings : data) as Record<string, unknown>

  const lastRunAt = (raw.lastRunAt ?? raw.nightlyReviewLastRunAt ?? null) as string | null
  return {
    enabled: Boolean(raw.enabled ?? raw.nightlyReviewEnabled ?? false),
    hour: Number(raw.hour ?? raw.nightlyReviewHour ?? 2),
    timeZone: String(raw.timeZone ?? raw.nightlyReviewTimezone ?? 'America/Los_Angeles'),
    lastRunAt,
    lastRunDate: (raw.lastRunDate ?? raw.nightlyReviewLastRunDate ?? null) as string | null,
    lastError: (raw.lastError ?? raw.nightlyReviewLastError ?? null) as string | null,
    lastSummary: formatRunSummary(raw.lastSummary ?? raw.nightlyReviewLastSummary),
    pending: hasPendingReview(raw),
  }
}

export function NightlyReviewSettings({ classId, isArchived }: NightlyReviewSettingsProps) {
  const [settings, setSettings] = useState<NightlyReviewState>(defaults)
  const [enabled, setEnabled] = useState(defaults.enabled)
  const [hour, setHour] = useState(defaults.hour)
  const [timeZone, setTimeZone] = useState(defaults.timeZone)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [queueing, setQueueing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const dirty = enabled !== settings.enabled || hour !== settings.hour || timeZone !== settings.timeZone

  const apply = useCallback((next: NightlyReviewState) => {
    setSettings(next)
    setEnabled(next.enabled)
    setHour(next.hour)
    setTimeZone(next.timeZone)
  }, [])

  const load = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    activeRequest.current = controller
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/classes/${classId}/nightly-review`, { signal: controller.signal })
      if (!response.ok) throw new Error('Could not load nightly review settings.')
      const next = readSettings(await response.json())
      if (generation === requestGeneration.current && !controller.signal.aborted) apply(next)
    } catch (requestError) {
      if (generation === requestGeneration.current && !(requestError instanceof DOMException && requestError.name === 'AbortError')) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load nightly review settings.')
      }
    } finally {
      if (generation === requestGeneration.current) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }, [apply, classId])

  useEffect(() => {
    load()
    return () => {
      requestGeneration.current += 1
      activeRequest.current?.abort()
    }
  }, [load])

  async function save() {
    if (isArchived) return
    const validationError = validateNightlyReviewDraft({ enabled, hour, timeZone })
    if (validationError) { setError(validationError); return }
    const generation = requestGeneration.current
    setSaving(true); setError(null); setNotice(null)
    try {
      const response = await fetch(`/api/classes/${classId}/nightly-review`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, hour, timeZone }),
      })
      if (!response.ok) throw new Error('Could not save nightly review settings.')
      const next = readSettings(await response.json())
      if (generation === requestGeneration.current) { apply(next); setNotice('Nightly review settings saved.') }
    } catch (requestError) {
      if (generation === requestGeneration.current) setError(requestError instanceof Error ? requestError.message : 'Could not save nightly review settings.')
    } finally {
      if (generation === requestGeneration.current) setSaving(false)
    }
  }

  async function queueRun() {
    if (isArchived || !settings.enabled || dirty) return
    const generation = requestGeneration.current
    setQueueing(true); setError(null); setNotice(null)
    try {
      const response = await fetch(`/api/classes/${classId}/nightly-review/run`, { method: 'POST' })
      if (!response.ok) throw new Error('Could not queue a nightly review request.')
      const data = await response.json().catch(() => ({}))
      if (generation === requestGeneration.current) {
        setSettings(current => ({ ...current, ...(data.settings || data), pending: true }))
        setNotice('Queued request recorded. It is waiting for the background runner; this does not mean the review is complete.')
      }
    } catch (requestError) {
      if (generation === requestGeneration.current) setError(requestError instanceof Error ? requestError.message : 'Could not queue a nightly review request.')
    } finally {
      if (generation === requestGeneration.current) setQueueing(false)
    }
  }

  if (loading) return <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading nightly review settings…</div>

  return (
    <section className="mt-3 space-y-3 border-t pt-3" aria-label="Nightly AI review settings" data-class-id={classId}>
      <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><h4 className="text-sm font-semibold">Nightly AI review</h4></div>
      <p className="text-xs text-muted-foreground">Enabling this permits automatic CoyoteGPT processing of saved tickets at the configured local hour. A separate background runner must be operating; this page only stores settings and queues requests.</p>
      {isArchived && <p className="text-xs font-medium text-muted-foreground">Archived classes are read-only. Restore this class to change settings or queue a review.</p>}
      {error && <div role="alert" className="flex gap-2 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />{error}</div>}
      {notice && <p aria-live="polite" className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={isArchived} />Enable automatic nightly review</label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium">Local hour (0–23)<Input type="number" min={0} max={23} step={1} value={hour} onChange={event => setHour(Number(event.target.value))} disabled={isArchived} /></label>
        <label className="text-xs font-medium">IANA time zone<Input value={timeZone} onChange={event => setTimeZone(event.target.value)} list={`nightly-time-zones-${classId}`} disabled={isArchived} /></label>
        <datalist id={`nightly-time-zones-${classId}`}><option value="America/Los_Angeles" /><option value="America/Denver" /><option value="America/Chicago" /><option value="America/New_York" /><option value="UTC" /></datalist>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={isArchived || saving || queueing || !dirty}>{saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}Save settings</Button>
        <Button type="button" size="sm" variant="secondary" onClick={queueRun} disabled={isArchived || saving || queueing || settings.pending || !settings.enabled || dirty}>{queueing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}{settings.pending ? 'Request queued' : 'Queue review now'}</Button>
      </div>
      {settings.pending && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">A queued request is pending. Completion will be reported only after the background runner processes it.</p>}
      {(settings.lastRunAt || settings.lastRunDate) && <p className="text-xs text-muted-foreground">Last runner activity: {settings.lastRunAt ? new Date(settings.lastRunAt).toLocaleString() : settings.lastRunDate}</p>}
      {settings.lastSummary && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{settings.lastSummary}</p>}
      {settings.lastError && <p className="text-xs text-destructive">Last runner error: {settings.lastError}</p>}
    </section>
  )
}
