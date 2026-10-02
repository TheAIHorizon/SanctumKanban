'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
type Preview = { previewHash: string; rows: { id: string; firstName: string; lastName: string; email: string; action: 'CREATE' | 'KEEP' }[] }
export function IndividualBoards({ classId, className, onComplete, onClose }: { classId: string; className: string; onComplete: () => void; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; kept: number } | null>(null)
  async function submit(action: 'preview' | 'create') {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/classes/${classId}/individual-boards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, previewHash: preview?.previewHash }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not create boards.')
      if (action === 'preview') setPreview(body)
      else { setResult(body); setPreview(null); onComplete() }
    } catch (e) { setPreview(null); setError((e as Error).message || 'Connection interrupted. Preview again to check the current boards.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Individual boards" className="rounded-lg border bg-card p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">One Kanban per student — {className}</h2><Button variant="ghost" disabled={busy} onClick={onClose}>Close individual boards</Button></div>
    <p className="text-sm">Create a board for each enrolled student, named after them. Each student manages their own board, with its own tickets, Gantt chart and reflections. Existing teams and work stay intact. Classmates can still view boards under the current class visibility rules.</p>
    <p className="text-sm">Students already given an individual board keep it. Instructor and observer accounts are excluded. Import or enroll students first; you can repeat this for later enrollments.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!result && <Button disabled={busy} onClick={() => submit('preview')}>{busy ? 'Working…' : 'Preview individual boards'}</Button>}
    {preview && <>
      <p role="status">{preview.rows.filter(r => r.action === 'CREATE').length} boards to create · {preview.rows.filter(r => r.action === 'KEEP').length} existing individual boards to keep</p>
      {preview.rows.length === 0 && <p>No students enrolled yet. Use Import students to add a roster.</p>}
      <ul className="max-h-80 overflow-y-auto divide-y">{preview.rows.map(r => <li className="py-2 text-sm" key={r.id}><span className="font-medium">{r.firstName} {r.lastName}</span> <span className="break-all text-muted-foreground">({r.email})</span> — {r.action === 'CREATE' ? 'Create individual board' : 'Keep existing board'}</li>)}</ul>
      <Button disabled={busy || !preview.rows.some(r => r.action === 'CREATE')} onClick={() => submit('create')}>Create reviewed boards</Button>
    </>}
    {result && <><p role="status">{result.created} individual boards created; {result.kept} existing boards kept.</p><Link className="underline" href={`/?classId=${classId}`}>Open class boards</Link></>}
  </section>
}
