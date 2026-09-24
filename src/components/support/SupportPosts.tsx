'use client'
import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SUPPORT_KINDS, SUPPORT_STATUSES, SupportPostView } from '@/lib/support-posts'
const field = 'block w-full rounded-md border bg-background px-3 py-2 mt-1'
async function readResponse(response: Response) {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.')
  return data
}
function StaffResponse({ post, onSaved }: { post: SupportPostView; onSaved: (p: SupportPostView) => void }) {
  const [status, setStatus] = useState(post.status), [reply, setReply] = useState(post.staffReply)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { onSaved(await readResponse(await fetch(`/api/support/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, staffReply: reply, updatedAt: post.updatedAt }) }))) }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <form onSubmit={save} className="space-y-3 border-t pt-4">
    <h3 className="font-semibold">Staff response</h3>
    <label className="block">Status<select aria-label="Status" className={field} value={status} onChange={e => setStatus(e.target.value as typeof status)}>{Object.entries(SUPPORT_STATUSES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
    <label className="block">Response to submitter<textarea className={field} rows={5} maxLength={10000} value={reply} onChange={e => setReply(e.target.value)} /></label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button disabled={busy}>{busy ? 'Saving…' : 'Save response'}</Button>
  </form>
}
export function SupportPosts({ staff }: { staff: boolean }) {
  const [kind, setKind] = useState('BUG'), [title, setTitle] = useState(''), [description, setDescription] = useState(''), [steps, setSteps] = useState('')
  const [posting, setPosting] = useState(false), [postError, setPostError] = useState(''), [message, setMessage] = useState('')
  const [posts, setPosts] = useState<SupportPostView[]>([]), [selected, setSelected] = useState<SupportPostView | null>(null)
  const [filterKind, setFilterKind] = useState(''), [filterStatus, setFilterStatus] = useState(''), [page, setPage] = useState(1)
  const [total, setTotal] = useState(0), [version, setVersion] = useState(0), [loading, setLoading] = useState(true), [listError, setListError] = useState('')
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setListError('')
    const query = new URLSearchParams({ page: String(page), ...(filterKind ? { kind: filterKind } : {}), ...(filterStatus ? { status: filterStatus } : {}) })
    fetch('/api/support?' + query, { signal: controller.signal, cache: 'no-store' }).then(readResponse).then(data => {
      if (!controller.signal.aborted) { setPosts(data.posts); setTotal(data.total) }
    }).catch(e => { if (!controller.signal.aborted) setListError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, filterKind, filterStatus, version])
  async function submit(event: FormEvent) {
    event.preventDefault(); setPosting(true); setPostError(''); setMessage('')
    try {
      const post = await readResponse(await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, title, description, steps: kind === 'BUG' ? steps : '' }) }))
      setSelected(post); setTitle(''); setDescription(''); setSteps(''); setPage(1); setFilterKind(''); setFilterStatus(''); setVersion(v => v + 1); setMessage('Your post was submitted. You can track its status below.')
    } catch (e) { setPostError((e as Error).message) } finally { setPosting(false) }
  }
  const date = (value: string) => new Date(value).toLocaleString()
  return <main className="mx-auto max-w-6xl space-y-6 py-6">
    <div><h1 className="text-2xl font-bold">Feature requests & bug reports</h1><p className="mt-2 text-muted-foreground">Suggest an improvement or tell us what went wrong. Posts are visible to their submitter and staff.</p></div>
    <form onSubmit={submit} className="rounded-lg border p-5 space-y-4">
      <h2 className="text-lg font-semibold">New post</h2>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <label>Post type<select aria-label="Post type" className={field} value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(SUPPORT_KINDS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>Title<input className={field} required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      </div>
      <label className="block">Description<textarea className={field} required minLength={10} maxLength={10000} rows={4} placeholder={kind === 'BUG' ? 'What did you expect to happen, and what happened instead?' : 'What would you like to do, and how would it help?'} value={description} onChange={e => setDescription(e.target.value)} /></label>
      {kind === 'BUG' && <label className="block">Steps to reproduce (optional)<textarea className={field} rows={3} maxLength={5000} placeholder="Which page were you on, and what steps led to the problem?" value={steps} onChange={e => setSteps(e.target.value)} /></label>}
      <p className="text-sm text-muted-foreground">Please leave out passwords, API keys, and private student information.</p>
      {postError && <p role="alert" className="text-destructive">{postError}</p>}
      <Button disabled={posting}>{posting ? 'Submitting…' : 'Submit post'}</Button>
    </form>
    {message && <p role="status" className="rounded border p-3">{message}</p>}
    <section className="space-y-4" aria-label="Submissions">
      <div className="flex flex-wrap items-center gap-3"><h2 className="mr-auto text-lg font-semibold">{staff ? 'All submissions' : 'My submissions'}</h2><Button variant="outline" onClick={() => { setSelected(null); setVersion(v => v + 1) }}>Refresh submissions</Button></div>
      <div className="flex flex-wrap gap-4">
        <label>Filter by type<select aria-label="Filter by type" className={field} value={filterKind} onChange={e => { setFilterKind(e.target.value); setPage(1) }}><option value="">All types</option>{Object.entries(SUPPORT_KINDS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>Filter by status<select aria-label="Filter by status" className={field} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}><option value="">All statuses</option>{Object.entries(SUPPORT_STATUSES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      </div>
      {listError && <p role="alert" className="text-destructive">{listError}</p>}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="min-w-0 space-y-2" aria-busy={loading}>
          {loading ? <p>Loading submissions…</p> : posts.length ? posts.map(post => <button key={post.id} type="button" aria-pressed={selected?.id === post.id} onClick={() => { setSelected(post); setMessage('') }} className={`block w-full rounded-lg border p-4 text-left break-words ${selected?.id === post.id ? 'border-primary bg-muted' : 'hover:bg-muted/50'}`}>
            <span className="block text-xs text-muted-foreground">{SUPPORT_KINDS[post.kind]} · {SUPPORT_STATUSES[post.status]}</span><span className="block font-semibold mt-1">{post.title}</span><span className="block text-xs text-muted-foreground mt-1">{date(post.createdAt)}{staff ? ` · ${post.author ? post.author.firstName + ' ' + post.author.lastName : 'Deleted account'}` : ''}</span>
          </button>) : !listError && <p className="text-muted-foreground">No submissions match these filters.</p>}
          <div className="flex items-center gap-3 pt-3"><Button variant="outline" disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-sm">Page {page} · {total} posts</span><Button variant="outline" disabled={loading || page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</Button></div>
        </div>
        {selected ? <article className="min-w-0 rounded-lg border p-5 space-y-4" aria-label="Post details">
          <div><p className="text-sm text-muted-foreground">{SUPPORT_KINDS[selected.kind]} · {SUPPORT_STATUSES[selected.status]}</p><h2 className="text-xl font-semibold break-words">{selected.title}</h2><p className="text-xs text-muted-foreground mt-1">Updated {date(selected.updatedAt)}</p></div>
          <div><h3 className="font-semibold">Description</h3><p className="whitespace-pre-wrap break-words">{selected.description}</p></div>
          {selected.steps && <div><h3 className="font-semibold">Steps to reproduce</h3><p className="whitespace-pre-wrap break-words">{selected.steps}</p></div>}
          {staff ? <StaffResponse key={selected.id + selected.updatedAt} post={selected} onSaved={post => { setSelected(post); setVersion(v => v + 1); setMessage('Status and response saved.') }} /> : <div className="border-t pt-4"><h3 className="font-semibold">Staff response</h3><p className="whitespace-pre-wrap break-words">{selected.staffReply || 'No response yet. Check back here for updates.'}</p></div>}
        </article> : <p className="text-muted-foreground p-5">Select a post to read its details and staff response.</p>}
      </div>
    </section>
  </main>
}
