'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Bot, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { guidanceDraftLabel } from '@/lib/saved-ticket-guidance'

interface SavedGuidanceFeedback { category?: string; message?: string; question?: string }
interface SavedGuidanceTask {
  id?: string
  ksatId?: string
  description?: string
  rationale?: string
  source?: { ksatId?: string; description?: string }
}
interface SavedGuidanceReview {
  id: string
  createdAt: string
  updatedAt: string
  mode: string
  model: string | null
  guidance: string | { summary?: string; feedback?: SavedGuidanceFeedback[]; abstained?: boolean }
  tasks: SavedGuidanceTask[]
  candidateCount: number
  isCurrent: boolean
}

interface SavedTicketGuidanceProps {
  ticketId: string
  compact?: boolean
}

function guidanceSummary(review: SavedGuidanceReview) {
  return typeof review.guidance === 'string' ? review.guidance : review.guidance.summary || ''
}

export function SavedTicketGuidance({ ticketId, compact = false }: SavedTicketGuidanceProps) {
  const [requested, setRequested] = useState(false)
  const [reviews, setReviews] = useState<SavedGuidanceReview[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    requestGeneration.current += 1
    activeRequest.current?.abort()
    activeRequest.current = null
    setRequested(false)
    setReviews([])
    setHasMore(false)
    setExpanded(null)
    setLoading(false)
    setError(null)
    return () => activeRequest.current?.abort()
  }, [ticketId])

  async function loadGuidance() {
    activeRequest.current?.abort()
    const controller = new AbortController()
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    activeRequest.current = controller
    setRequested(true)
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tickets/${ticketId}/guidance`, { signal: controller.signal })
      if (!response.ok) throw new Error('Could not load saved guidance for this ticket.')
      const data = await response.json() as { reviews: SavedGuidanceReview[]; hasMore: boolean }
      if (generation !== requestGeneration.current || controller.signal.aborted) return
      const next = [...(data.reviews || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      setReviews(next)
      setHasMore(Boolean(data.hasMore))
      setExpanded(next[0]?.id || null)
    } catch (requestError) {
      if (generation === requestGeneration.current && !(requestError instanceof DOMException && requestError.name === 'AbortError')) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load saved guidance for this ticket.')
      }
    } finally {
      if (generation === requestGeneration.current) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }

  if (!requested) {
    return <Button type="button" size={compact ? 'sm' : 'default'} variant="outline" onClick={loadGuidance}><Bot className="mr-2 h-4 w-4" />Load saved guidance</Button>
  }

  return (
    <section className="space-y-3 rounded-md border bg-background/90 p-3 text-foreground" aria-label="Saved ticket guidance">
      <div>
        <h4 className="text-sm font-semibold">Saved AI guidance</h4>
        <p className="text-xs text-muted-foreground">Historical, AI-generated guidance for the saved ticket draft. Nothing is applied automatically.</p>
      </div>
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading saved guidance…</div>}
      {error && <div role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}<Button type="button" size="sm" variant="outline" onClick={loadGuidance}>Try again</Button></div>}
      {!loading && !error && reviews.length === 0 && <p className="text-sm text-muted-foreground">No saved nightly reviews yet. Manual AI Coach results are not saved automatically.</p>}
      {reviews.map(review => {
        const isOpen = expanded === review.id
        const feedback = typeof review.guidance === 'string' ? [] : review.guidance.feedback || []
        return (
          <article key={review.id} className="rounded-md border p-3">
            <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpanded(isOpen ? null : review.id)} aria-expanded={isOpen}>
              <span className="space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={review.mode.startsWith('fallback') ? 'secondary' : 'default'}>{review.mode.startsWith('fallback') ? 'Keyword fallback' : 'AI-generated guidance'}</Badge>
                  <Badge variant="outline">{guidanceDraftLabel(review.isCurrent)}</Badge>
                </span>
                <span className="block text-xs text-muted-foreground">Last reviewed {new Date(review.updatedAt).toLocaleString()}{review.model ? ` · ${review.model}` : ''} · {review.candidateCount} candidates</span>
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {isOpen && <div className="mt-3 space-y-3 text-sm">
              {guidanceSummary(review) && <p className="whitespace-pre-wrap">{guidanceSummary(review)}</p>}
              {feedback.map((item, index) => <div key={`${review.id}:feedback:${index}`} className="rounded bg-muted/50 p-2"><p className="text-xs font-medium uppercase text-muted-foreground">{item.category || 'Guidance'}</p>{item.message && <p>{item.message}</p>}{item.question && <p className="mt-1 font-medium">{item.question}</p>}</div>)}
              {review.tasks?.length > 0 && <div><p className="text-xs font-medium text-muted-foreground">Suggested evidence (review before linking)</p><ul className="mt-1 list-disc space-y-1 pl-5">{review.tasks.map((task, index) => <li key={task.id || `${review.id}:task:${index}`}>{task.source?.ksatId || task.ksatId ? <strong>{task.source?.ksatId || task.ksatId}: </strong> : null}{task.source?.description || task.description || task.rationale || 'Saved task suggestion'}</li>)}</ul></div>}
            </div>}
          </article>
        )
      })}
      {hasMore && <p className="text-xs text-muted-foreground">Showing the latest reviews; older entries are retained.</p>}
    </section>
  )
}
