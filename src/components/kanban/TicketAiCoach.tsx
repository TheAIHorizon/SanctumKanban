'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface AiCoachFeedback {
  category: string
  message: string
  question: string
}

export interface AiCoachSource {
  kind: 'imported-dcwf'
  ksatId: string
  description: string
}

export interface AiCoachTask {
  id: string
  ksatId: string
  description: string
  rationale?: string
  source: AiCoachSource
  workRoles?: Array<{
    code: string
    title: string
    inScope: boolean
    coreOrAdditional: string | null
  }>
}

export interface AiCoachResponse {
  tasks: AiCoachTask[]
  guidance: {
    summary: string
    feedback: AiCoachFeedback[]
    abstained: boolean
  }
  usedAi: boolean
  mode: 'ai' | 'fallback'
  model: string | null
  candidateCount: number
}

interface TicketAiCoachProps {
  ticketId: string
  title: string
  description: string
  onOpenDcwf: () => void
}

const MAX_TASKS = 5
const MAX_FEEDBACK = 4
const MAX_SUMMARY_LENGTH = 700
const MAX_MESSAGE_LENGTH = 450
const MAX_QUESTION_LENGTH = 300
const MAX_EXCERPT_LENGTH = 360

function boundedText(value: string | undefined, maximum: number) {
  const text = value?.trim() || ''
  return text.length > maximum ? `${text.slice(0, maximum).trimEnd()}…` : text
}

export function TicketAiCoach({ ticketId, title, description, onOpenDcwf }: TicketAiCoachProps) {
  const [result, setResult] = useState<AiCoachResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const text = [title.trim(), description.trim()].filter(Boolean).join('\n\n')

  // A changed draft or ticket makes prior advice stale. Never leave an old
  // response visible for a new ticket, even if the old request resolves late.
  useEffect(() => {
    requestGeneration.current += 1
    activeRequest.current?.abort()
    activeRequest.current = null
    setResult(null)
    setError(null)
    setLoading(false)

    return () => activeRequest.current?.abort()
  }, [ticketId, title, description])

  async function requestCoaching() {
    if (!text || loading) return

    activeRequest.current?.abort()
    const controller = new AbortController()
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    activeRequest.current = controller
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/dcwf/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, text, inScopeOnly: true }),
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('The AI Coach is receiving too many requests. Wait a moment, then Try again.')
        }
        let detail = ''
        try {
          const body = await response.json()
          detail = typeof body?.error === 'string' ? body.error : ''
        } catch {
          // A non-JSON error response still gets the clear generic message below.
        }
        throw new Error(detail || 'The AI Coach request failed. Check your connection and Try again.')
      }

      const data = (await response.json()) as AiCoachResponse
      if (generation === requestGeneration.current && !controller.signal.aborted) {
        setResult(data)
      }
    } catch (requestError) {
      if (
        generation === requestGeneration.current &&
        !(requestError instanceof DOMException && requestError.name === 'AbortError')
      ) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'The AI Coach request failed. Check your connection and Try again.'
        )
      }
    } finally {
      if (generation === requestGeneration.current) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }

  const isActualAi = result?.mode === 'ai' && result.usedAi

  return (
    <section className="space-y-4" aria-labelledby="ai-coach-heading">
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <h3 id="ai-coach-heading" className="text-sm font-semibold">AI Coach</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          This ticket&apos;s current title and description, plus retrieved DCWF reference excerpts, are sent to your user-owned CoyoteGPT only after you choose Ask AI Coach.
          Separate student profiles and comments are not loaded. Do not put passwords or unnecessary personal information in the draft.
        </p>
        <p className="text-xs text-muted-foreground">
          This feedback is advisory, not a grade. Missing evidence does not mean the work was not done;
          use the questions to decide what context you want to add.
        </p>
      </div>

      <Button
        type="button"
        onClick={requestCoaching}
        disabled={loading || !text}
        aria-label={loading ? 'AI Coach request in progress' : 'Ask AI Coach about this ticket draft'}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {loading ? 'Asking AI Coach…' : 'Ask AI Coach'}
      </Button>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <p>{error}</p>
              <Button type="button" size="sm" variant="outline" onClick={requestCoaching} disabled={loading || !text}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isActualAi ? 'default' : 'secondary'}>
              {isActualAi ? 'CoyoteGPT response' : 'Keyword fallback'}
            </Badge>
            {isActualAi && result.model && (
              <span className="text-xs text-muted-foreground">Model: {boundedText(result.model, 80)}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {result.candidateCount} framework candidate{result.candidateCount === 1 ? '' : 's'} considered
            </span>
          </div>

          {!isActualAi && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Keyword fallback was used because an actual CoyoteGPT response was unavailable. These are search matches, not AI coaching.
            </p>
          )}

          {result.guidance.abstained ? (
            <p className="text-sm text-muted-foreground">
              The coach did not have enough evidence in this draft to offer guidance. You can add context and ask again.
            </p>
          ) : (
            <>
              {result.guidance.summary && (
                <div>
                  <h4 className="text-sm font-medium">Summary</h4>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {boundedText(result.guidance.summary, MAX_SUMMARY_LENGTH)}
                  </p>
                </div>
              )}

              {result.guidance.feedback.slice(0, MAX_FEEDBACK).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Questions to consider</h4>
                  {result.guidance.feedback.slice(0, MAX_FEEDBACK).map((item, index) => (
                    <div key={`${item.category}-${index}`} className="rounded-md border p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {boundedText(item.category, 60)}
                      </p>
                      <p className="mt-1 text-sm">{boundedText(item.message, MAX_MESSAGE_LENGTH)}</p>
                      {item.question && (
                        <p className="mt-2 text-sm font-medium">
                          {boundedText(item.question, MAX_QUESTION_LENGTH)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {result.tasks.slice(0, MAX_TASKS).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium">Possible DCWF evidence</h4>
                <Button type="button" size="sm" variant="outline" onClick={onOpenDcwf}>
                  Review and link in DCWF
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Nothing is linked automatically. Review the canonical source and confirm any link yourself.
              </p>
              {result.tasks.slice(0, MAX_TASKS).map((task) => (
                <article key={task.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{task.source.ksatId}</Badge>
                    <span className="text-[11px] text-muted-foreground">Canonical imported DCWF task</span>
                  </div>
                  <p className="mt-2 text-sm">
                    {boundedText(task.source.description, MAX_EXCERPT_LENGTH)}
                  </p>
                  {task.rationale && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Why it may fit: {boundedText(task.rationale, MAX_MESSAGE_LENGTH)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
