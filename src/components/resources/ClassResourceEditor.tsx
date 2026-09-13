'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  MAX_RESOURCE_URL_LENGTH,
  RESOURCE_DEFINITIONS,
  type ResourceEntry,
  type ResourceKey,
} from '@/lib/student-resources'

interface ClassResourceEditorProps {
  classId: string
  disabled?: boolean
}

type Values = Record<ResourceKey, string>

const emptyValues = () => Object.fromEntries(
  RESOURCE_DEFINITIONS.map(({ key }) => [key, ''])
) as Values

function valuesFromResources(resources: ResourceEntry[]): Values {
  const next = emptyValues()
  for (const { key, url } of resources) next[key] = url
  return next
}

async function fetchResources(classId: string): Promise<ResourceEntry[]> {
  const response = await fetch(`/api/classes/${classId}/resources`)
  if (!response.ok) throw new Error('Could not load resources')
  return response.json() as Promise<ResourceEntry[]>
}

export function ClassResourceEditor({ classId, disabled = false }: ClassResourceEditorProps) {
  const { toast } = useToast()
  const [values, setValues] = useState<Values>(emptyValues)
  const [baselineResources, setBaselineResources] = useState<ResourceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [conflicted, setConflicted] = useState(false)
  const [loadedClassId, setLoadedClassId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadedClassId(null)
    setLoadError(false)
    fetchResources(classId)
      .then((resources) => {
        if (cancelled) return
        setValues(valuesFromResources(resources))
        setBaselineResources(resources)
        setConflicted(false)
        setLoadedClassId(classId)
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(true)
          toast({ title: error.message, variant: 'destructive' })
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId, retry, toast])

  const reloadLatest = async () => {
    setReloading(true)
    try {
      const currentResources = await fetchResources(classId)
      setValues(valuesFromResources(currentResources))
      setBaselineResources(currentResources)
      setConflicted(false)
      setLoadError(false)
    } catch (error) {
      toast({
        title: 'Could not reload resources',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setReloading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/classes/${classId}/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resources: RESOURCE_DEFINITIONS.map(({ key }) => ({ key, url: values[key] })),
          expectedResources: baselineResources,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setConflicted(true)
        throw new Error(`${body.error || 'Resources changed'}; your draft was preserved, but saving is disabled until you reload the latest version`)
      }
      if (!response.ok) throw new Error(body.error || 'Could not save resources')
      const savedResources = body as ResourceEntry[]
      setBaselineResources(savedResources)
      setValues(valuesFromResources(savedResources))
      toast({ title: 'Student resources saved' })
    } catch (error) {
      toast({
        title: 'Could not save resources',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || loadedClassId !== classId) {
    if (loadError) return (
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Resources could not be loaded. Editing is disabled.</span>
        <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}><RefreshCw className="mr-1 h-4 w-4" />Retry</Button>
      </div>
    )
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading resources…</div>
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        Add only the real HTTP(S) destinations for this class. Blank resources stay hidden from students.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {RESOURCE_DEFINITIONS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`${classId}-${key}`}>{label}</Label>
            <Input
              id={`${classId}-${key}`}
              type="url"
              inputMode="url"
              maxLength={MAX_RESOURCE_URL_LENGTH}
              placeholder="https://…"
              value={values[key]}
              disabled={disabled || saving}
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
            />
          </div>
        ))}
      </div>
      {conflicted && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/50 p-3 text-sm">
          <span>These resources changed elsewhere. Copy your draft before reloading because reloading will replace it.</span>
          <Button variant="outline" size="sm" onClick={reloadLatest} disabled={reloading}>
            {reloading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Reload latest
          </Button>
        </div>
      )}
      {!disabled && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || conflicted}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save resources
          </Button>
        </div>
      )}
    </div>
  )
}
