'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, MessageSquareReply, Pin, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sortFeedbackChronologically } from '@/lib/team-feedback'

export type FeedbackCategory = 'GUIDANCE' | 'NEEDS_ATTENTION' | 'ACTION_REQUIRED'

interface FeedbackReply {
  id: string
  body: string
  authorName: string
  createdAt: string
}

interface FeedbackAcknowledgment {
  userId: string
  userName: string
  createdAt: string
}

export interface FeedbackPost {
  id: string
  body: string
  category: FeedbackCategory
  pinned: boolean
  createdAt: string
  authorName: string
  ticket: { id: string; title: string } | null
  replies: FeedbackReply[]
  acknowledgments: FeedbackAcknowledgment[]
  acknowledgedByMe: boolean
  isUnread: boolean
}

interface TeamFeedbackProps {
  teamId: string
  tickets: Array<{ id: string; title: string }>
  isAdmin: boolean
  readOnly?: boolean
  onUnreadCountChange?: (count: number) => void
  onOpenTicket?: (id: string) => void
}

const categoryLabels: Record<FeedbackCategory, string> = {
  GUIDANCE: 'Guidance',
  NEEDS_ATTENTION: 'Needs attention',
  ACTION_REQUIRED: 'Action required',
}

const categoryClasses: Record<FeedbackCategory, string> = {
  GUIDANCE: 'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  NEEDS_ATTENTION: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  ACTION_REQUIRED: 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200',
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function TeamFeedback({ teamId, tickets, isAdmin, readOnly = false, onUnreadCountChange, onOpenTicket }: TeamFeedbackProps) {
  const [posts, setPosts] = useState<FeedbackPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('GUIDANCE')
  const [ticketId, setTicketId] = useState('')
  const [pinned, setPinned] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const requestGeneration = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    activeRequest.current = controller
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/teams/${teamId}/feedback`, { signal: controller.signal })
      if (!response.ok) throw new Error('Could not load instructor feedback.')
      const data = await response.json() as { posts: FeedbackPost[]; unreadCount: number }
      if (generation !== requestGeneration.current || controller.signal.aborted) return
      setPosts(sortFeedbackChronologically(data.posts || []))
      onUnreadCountChange?.(data.unreadCount || 0)
    } catch (requestError) {
      if (generation === requestGeneration.current && !(requestError instanceof DOMException && requestError.name === 'AbortError')) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load instructor feedback.')
      }
    } finally {
      if (generation === requestGeneration.current) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }, [teamId, onUnreadCountChange])

  useEffect(() => {
    load()
    return () => {
      requestGeneration.current += 1
      activeRequest.current?.abort()
    }
  }, [load])

  async function mutate(url: string, options: RequestInit, key: string) {
    setBusyKey(key)
    setError(null)
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'The feedback update was not saved.')
      }
      await load()
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The feedback update was not saved.')
      return false
    } finally {
      setBusyKey(null)
    }
  }

  async function createPost(event: React.FormEvent) {
    event.preventDefault()
    if (!body.trim() || readOnly) return
    const saved = await mutate(`/api/teams/${teamId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: body.trim(), category, ticketId: ticketId || undefined, pinned }),
    }, 'create')
    if (saved) { setBody(''); setTicketId(''); setPinned(false) }
  }

  async function reply(feedbackId: string) {
    const replyBody = replyDrafts[feedbackId]?.trim()
    if (!replyBody || readOnly) return
    const saved = await mutate(`/api/teams/${teamId}/feedback/${feedbackId}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: replyBody }),
    }, `reply:${feedbackId}`)
    if (saved) setReplyDrafts(current => ({ ...current, [feedbackId]: '' }))
  }

  const acknowledge = (feedbackId: string) => mutate(`/api/teams/${teamId}/feedback/${feedbackId}/acknowledge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  }, `ack:${feedbackId}`)

  const togglePin = (feedbackId: string, nextPinned: boolean) => mutate(`/api/teams/${teamId}/feedback/${feedbackId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: nextPinned }),
  }, `pin:${feedbackId}`)

  async function markAllRead() {
    const throughId = posts.reduce<FeedbackPost | null>((newest, post) => (
      !newest || Date.parse(post.createdAt) > Date.parse(newest.createdAt) ? post : newest
    ), null)?.id
    if (!throughId) return
    await mutate(`/api/teams/${teamId}/feedback/read`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ throughId }),
    }, 'read')

  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading feedback…</div>

  return (
    <section className="space-y-4" aria-label="Instructor feedback">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Private instructor guidance for this team.</p>
        {!readOnly && posts.some(post => post.isUnread) && <Button type="button" size="sm" variant="outline" onClick={markAllRead} disabled={busyKey === 'read'}>Mark all read</Button>}
      </div>
      {readOnly && <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">This archived class is read-only. Feedback remains available for review.</p>}
      {error && <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {isAdmin && !readOnly && (
        <form onSubmit={createPost} className="space-y-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">Post instructor feedback</h3>
          <Textarea aria-label="Instructor feedback message" value={body} onChange={event => setBody(event.target.value)} placeholder="Write guidance for this team…" rows={3} />
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Feedback category" className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={event => setCategory(event.target.value as FeedbackCategory)}>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="Related team ticket" className="h-9 rounded-md border bg-background px-3 text-sm" value={ticketId} onChange={event => setTicketId(event.target.value)}>
              <option value="">No related ticket</option>
              {tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{ticket.title}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)} />Pin this post</label>
            <Button type="submit" size="sm" disabled={!body.trim() || busyKey === 'create'}>{busyKey === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Post</Button>
          </div>
        </form>
      )}

      {posts.length === 0 ? <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No instructor feedback has been posted.</p> : posts.map(post => (
        <article key={post.id} className={`rounded-lg border p-4 ${post.isUnread ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={categoryClasses[post.category]}>{categoryLabels[post.category]}</Badge>
            {post.pinned && <Badge variant="outline"><Pin className="mr-1 h-3 w-3" />Pinned</Badge>}
            {post.isUnread && <Badge variant="secondary">Unread</Badge>}
            <span className="text-xs text-muted-foreground">{post.authorName} · {formatTimestamp(post.createdAt)}</span>
            {isAdmin && !readOnly && <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => togglePin(post.id, !post.pinned)} disabled={busyKey === `pin:${post.id}`}>{post.pinned ? 'Unpin' : 'Pin'}</Button>}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>
          {post.ticket && <button type="button" className="mt-2 text-left text-xs font-medium text-primary underline" onClick={() => onOpenTicket?.(post.ticket!.id)}>Related ticket: {post.ticket.title}</button>}
          {post.replies.length > 0 && <div className="mt-4 space-y-2 border-l-2 pl-3">{post.replies.map(item => <div key={item.id}><p className="text-xs text-muted-foreground">{item.authorName} · {formatTimestamp(item.createdAt)}</p><p className="whitespace-pre-wrap text-sm">{item.body}</p></div>)}</div>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {post.acknowledgments.length > 0 && <span>{post.acknowledgments.map(item => item.userName).join(', ')} acknowledged</span>}
            {!readOnly && !post.acknowledgedByMe && <Button type="button" size="sm" variant="outline" onClick={() => acknowledge(post.id)} disabled={busyKey === `ack:${post.id}`}><Check className="mr-1 h-3.5 w-3.5" />Acknowledge</Button>}
          </div>
          {!readOnly && <div className="mt-3 flex gap-2"><Textarea aria-label={`Reply to feedback from ${post.authorName}`} rows={2} value={replyDrafts[post.id] || ''} onChange={event => setReplyDrafts(current => ({ ...current, [post.id]: event.target.value }))} placeholder="Reply to your instructor…" /><Button type="button" aria-label={`Send reply to ${post.authorName}`} size="icon" variant="outline" onClick={() => reply(post.id)} disabled={!replyDrafts[post.id]?.trim() || busyKey === `reply:${post.id}`}><MessageSquareReply className="h-4 w-4" /></Button></div>}
        </article>
      ))}
    </section>
  )
}
