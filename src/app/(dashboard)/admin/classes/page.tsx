'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, BookOpen, Copy, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface Workspace {
  id: string
  name: string
  code: string | null
  term: string | null
  description: string | null
  archivedAt: string | null
  _count: { teams: number }
}

export default function ClassesPage() {
  const { toast } = useToast()
  const [active, setActive] = useState<Workspace[]>([])
  const [archived, setArchived] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [term, setTerm] = useState('')
  const [description, setDescription] = useState('')
  const [copyFrom, setCopyFrom] = useState('')

  const load = async () => {
    const [a, old] = await Promise.all([
      fetch('/api/classes'),
      fetch('/api/classes?archived=true'),
    ])
    if (a.ok) setActive(await a.json())
    if (old.ok) setArchived(await old.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, code, term, description,
        copyTeamStructureFromId: copyFrom || undefined,
      }),
    })
    setSaving(false)
    if (response.ok) {
      const created = await response.json()
      toast({ title: 'Class created', description: `${created.name} is ready with ${created._count.teams} team boards.` })
      setName(''); setCode(''); setTerm(''); setDescription(''); setCopyFrom(''); setShowCreate(false)
      load()
    } else {
      toast({ title: 'Could not create class', variant: 'destructive' })
    }
  }

  const lifecycle = async (workspace: Workspace, action: 'archive' | 'restore') => {
    const verb = action === 'archive' ? 'archive' : 'restore'
    if (!window.confirm(`${verb[0].toUpperCase() + verb.slice(1)} “${workspace.name}”? ${action === 'archive' ? 'Its boards will become read-only but all data will be preserved.' : ''}`)) return
    const response = await fetch(`/api/classes/${workspace.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    if (response.ok) {
      toast({ title: action === 'archive' ? 'Class archived' : 'Class restored' })
      load()
    }
  }

  const WorkspaceCard = ({ workspace, isArchived }: { workspace: Workspace; isArchived: boolean }) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{workspace.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {[workspace.code, workspace.term].filter(Boolean).join(' · ') || 'No code/term'} · {workspace._count.teams} teams
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => lifecycle(workspace, isArchived ? 'restore' : 'archive')}>
            {isArchived ? <ArchiveRestore className="mr-1 h-4 w-4" /> : <Archive className="mr-1 h-4 w-4" />}
            {isArchived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workspace.description && <p className="text-sm text-muted-foreground mb-3">{workspace.description}</p>}
        <Link href={`/?classId=${workspace.id}${isArchived ? '&archived=1' : ''}`}>
          <Button variant="secondary" size="sm"><BookOpen className="mr-1 h-4 w-4" />Open board</Button>
        </Link>
      </CardContent>
    </Card>
  )

  if (loading) return <div className="p-6 flex gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading classes…</div>

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-muted-foreground">Each class has its own teams and board. Archive a completed class without losing its history.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}><Plus className="mr-1 h-4 w-4" />New class</Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create class workspace</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="IST 4910 — Fall 2027" /></div>
            <div><Label>Course code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="IST 4910" /></div>
            <div><Label>Term</Label><Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Fall 2027" /></div>
            <div>
              <Label>Team layout</Label>
              <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Start empty</option>
                {active.map((workspace) => <option key={workspace.id} value={workspace.id}>Copy team names from {workspace.name}</option>)}
                {archived.map((workspace) => <option key={workspace.id} value={workspace.id}>Copy team names from archived {workspace.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Copy className="h-3.5 w-3.5" />Copying creates clean, empty boards—no old tickets or students.</p>
              <Button onClick={create} disabled={saving || !name.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create class'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="font-semibold mb-3">Active classes ({active.length})</h2>
        <div className="grid gap-4 md:grid-cols-2">{active.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} isArchived={false} />)}</div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Archived classes ({archived.length})</h2>
        {archived.length === 0 ? <p className="text-sm text-muted-foreground">No archived classes.</p> : (
          <div className="grid gap-4 md:grid-cols-2">{archived.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} isArchived />)}</div>
        )}
      </section>
    </div>
  )
}
