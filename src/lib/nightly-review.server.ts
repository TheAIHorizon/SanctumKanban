import {
  generateAdvice,
  rankDcwfTasks,
  type AdviceChat,
  type CoachingGuidance,
  type DcwfCandidate,
  type SuggestedDcwfTask,
} from './dcwf-suggest'
import {
  NIGHTLY_PROMPT_VERSION,
  NIGHTLY_RETRY_MS,
  NIGHTLY_REVIEW_MODEL,
  computeNightlyInputHash,
  isNightlyReviewDue,
  localScheduleDate,
  normalizeBatchSize,
} from './nightly-review'

export interface ReviewClass {
  id: string
  archivedAt: Date | null
  nightlyReviewEnabled: boolean
  nightlyReviewHour: number
  nightlyReviewTimezone: string
  nightlyReviewRequestedAt: Date | null
  nightlyReviewLastRunAt: Date | null
  nightlyReviewLastRunDate: string | Date | null
}

export interface ExistingReview {
  inputHash: string
  mode: string
  nextRetryAt: Date | null
}

export interface ReviewTicket {
  id: string
  title: string
  description: string | null
  teamId: string
  classWorkspaceId: string | null
  archived: boolean
  reviews: ExistingReview[]
}

export interface SavedReview {
  ticketId: string
  inputHash: string
  model: string | null
  mode: string
  guidance: CoachingGuidance
  tasks: SuggestedDcwfTask[]
  candidateCount: number
  lastAttemptAt: Date
  nextRetryAt: Date | null
}

export interface NightlySummary {
  classes: number
  scanned: number
  attempted: number
  savedAi: number
  savedFallback: number
  skippedUnchanged: number
  skippedRetry: number
  stale: number
  remaining: number
}

export interface NightlyReviewRepository {
  acquireLease(owner: string, now: Date, expiresAt: Date): Promise<boolean>
  heartbeatLease(owner: string, now: Date, expiresAt: Date): Promise<boolean>
  ownsLease(owner: string, now: Date): Promise<boolean>
  releaseLease(owner: string): Promise<void>
  listClasses(): Promise<ReviewClass[]>
  listTickets(classId: string): Promise<ReviewTicket[]>
  /** Must return null unless class/ticket/team are still active, opted in, and related. */
  reloadTicket(ticketId: string, classId: string): Promise<ReviewTicket | null>
  loadCandidates(): Promise<DcwfCandidate[]>
  saveReview(review: SavedReview, guard: {
    owner: string
    classId: string
    teamId: string
    title: string
    description: string | null
    model: string
    promptVersion: string
  }): Promise<boolean>
  finishClassRun(result: {
    owner: string
    classId: string
    scheduleHour: number
    scheduleTimezone: string
    now: Date
    localRunDate: string
    processedRequestedAt: Date | null
    complete: boolean
    summary: NightlySummary
    error: string | null
  }): Promise<boolean>
  failClassRun(result: {
    owner: string
    classId: string
    scheduleHour: number
    scheduleTimezone: string
    summary: NightlySummary
    error: string
  }): Promise<boolean>
}

export interface RunNightlyOptions {
  repository: NightlyReviewRepository
  chat: AdviceChat
  owner: string
  now?: Date
  batchSize?: number
  model?: string
  promptVersion?: string
  leaseMs?: number
  dryRun?: boolean
}

export interface RunNightlyResult {
  acquired: boolean
  summary: NightlySummary
}

const emptySummary = (): NightlySummary => ({
  classes: 0,
  scanned: 0,
  attempted: 0,
  savedAi: 0,
  savedFallback: 0,
  skippedUnchanged: 0,
  skippedRetry: 0,
  stale: 0,
  remaining: 0,
})

function increment(overall: NightlySummary, local: NightlySummary, key: keyof NightlySummary, amount = 1): void {
  overall[key] += amount
  local[key] += amount
}

function ticketText(ticket: ReviewTicket): string {
  return ticket.description ? `${ticket.title}\n\n${ticket.description}` : ticket.title
}

function inputHash(ticket: ReviewTicket, model: string, promptVersion: string): string {
  return computeNightlyInputHash({
    title: ticket.title,
    description: ticket.description,
    model,
    promptVersion,
  })
}

function pendingReason(ticket: ReviewTicket, hash: string, now: Date): 'pending' | 'unchanged' | 'retry' {
  const review = ticket.reviews.find((item) => item.inputHash === hash)
  if (!review) return 'pending'
  if (review.mode === 'ai' || review.mode === 'fallback:no_candidates') return 'unchanged'
  if (review.nextRetryAt && review.nextRetryAt > now) return 'retry'
  return 'pending'
}

function labelledFallback(guidance: CoachingGuidance, reason: string): CoachingGuidance {
  return { ...guidance, summary: `Fallback (${reason}): ${guidance.summary}` }
}

/** One globally leased, serial and bounded review tick. No transaction spans inference. */
export async function runNightlyReviews(options: RunNightlyOptions): Promise<RunNightlyResult> {
  const now = options.now || new Date()
  const batchSize = normalizeBatchSize(options.batchSize)
  const model = options.model || NIGHTLY_REVIEW_MODEL
  const promptVersion = options.promptVersion || NIGHTLY_PROMPT_VERSION
  const summary = emptySummary()

  // Dry-run is deliberately read-only: no lease, model call, heartbeat, or metadata write.
  if (options.dryRun) {
    let remainingCapacity = batchSize
    const classes = (await options.repository.listClasses()).filter((item) => isNightlyReviewDue(item, now))
    for (const reviewClass of classes) {
      summary.classes += 1
      const tickets = await options.repository.listTickets(reviewClass.id)
      summary.scanned += tickets.length
      let pending = 0
      let deferred = 0
      for (const current of tickets) {
        const reason = pendingReason(current, inputHash(current, model, promptVersion), now)
        if (reason === 'unchanged') summary.skippedUnchanged += 1
        else if (reason === 'retry') { summary.skippedRetry += 1; deferred += 1 }
        else pending += 1
      }
      const selected = Math.min(pending, remainingCapacity)
      summary.attempted += selected
      summary.remaining += pending - selected + deferred
      remainingCapacity -= selected
    }
    return { acquired: true, summary }
  }

  const leaseMs = Math.max(60_000, options.leaseMs || 120_000)
  const expiresAt = new Date(now.getTime() + leaseMs)
  const acquired = await options.repository.acquireLease(options.owner, now, expiresAt)
  if (!acquired) return { acquired: false, summary }

  let activeClass: ReviewClass | null = null
  let activeClassSummary: NightlySummary | null = null
  try {
    const classes = (await options.repository.listClasses()).filter((item) => isNightlyReviewDue(item, now))
    let importedTasks: DcwfCandidate[] | null = null
    let remainingCapacity = batchSize

    for (const reviewClass of classes) {
      if (remainingCapacity === 0) break
      activeClass = reviewClass
      const classSummary = emptySummary()
      activeClassSummary = classSummary
      increment(summary, classSummary, 'classes')
      const tickets = await options.repository.listTickets(reviewClass.id)
      increment(summary, classSummary, 'scanned', tickets.length)
      const pending: Array<{ ticket: ReviewTicket; hash: string }> = []
      let deferred = 0
      for (const listed of tickets) {
        const hash = inputHash(listed, model, promptVersion)
        const reason = pendingReason(listed, hash, now)
        if (reason === 'unchanged') increment(summary, classSummary, 'skippedUnchanged')
        else if (reason === 'retry') { increment(summary, classSummary, 'skippedRetry'); deferred += 1 }
        else pending.push({ ticket: listed, hash })
      }

      const selected = pending.slice(0, remainingCapacity)
      const overflow = Math.max(0, pending.length - selected.length)
      increment(summary, classSummary, 'remaining', overflow + deferred)
      let classIncomplete = overflow > 0 || deferred > 0
      for (const item of selected) {
        increment(summary, classSummary, 'attempted')
        remainingCapacity -= 1

        // Recheck before any student content is sent to the model.
        const current = await options.repository.reloadTicket(item.ticket.id, reviewClass.id)
        if (!current || current.archived || current.teamId !== item.ticket.teamId || inputHash(current, model, promptVersion) !== item.hash) {
          increment(summary, classSummary, 'stale')
          increment(summary, classSummary, 'remaining')
          classIncomplete = true
          continue
        }
        const heartbeatNow = new Date()
        if (!await options.repository.heartbeatLease(options.owner, heartbeatNow, new Date(heartbeatNow.getTime() + leaseMs))) {
          throw new Error('Nightly review lease was lost')
        }
        if (!importedTasks) importedTasks = await options.repository.loadCandidates()
        const text = ticketText(current)
        const candidates = rankDcwfTasks(text, importedTasks, 20)
        const generated = await generateAdvice(text, candidates, options.chat, model)
        const reason = generated.fallbackReason
        const mode = reason ? `fallback:${reason}` : 'ai'
        const retryable = reason === 'request_failed' || reason === 'invalid_response'
        const review: SavedReview = {
          ticketId: current.id,
          inputHash: item.hash,
          model: generated.model,
          mode,
          guidance: reason ? labelledFallback(generated.advice.guidance, reason) : generated.advice.guidance,
          tasks: generated.advice.tasks,
          candidateCount: candidates.length,
          lastAttemptAt: now,
          nextRetryAt: retryable ? new Date(now.getTime() + NIGHTLY_RETRY_MS) : null,
        }
        const saved = await options.repository.saveReview(review, {
          owner: options.owner,
          classId: reviewClass.id,
          teamId: current.teamId,
          title: current.title,
          description: current.description,
          model,
          promptVersion,
        })
        if (!saved) {
          increment(summary, classSummary, 'stale')
          increment(summary, classSummary, 'remaining')
          classIncomplete = true
          continue
        }
        if (reason) increment(summary, classSummary, 'savedFallback')
        else increment(summary, classSummary, 'savedAi')
      }

      const finished = await options.repository.finishClassRun({
        owner: options.owner,
        classId: reviewClass.id,
        scheduleHour: reviewClass.nightlyReviewHour,
        scheduleTimezone: reviewClass.nightlyReviewTimezone,
        now,
        localRunDate: localScheduleDate(now, reviewClass.nightlyReviewTimezone),
        processedRequestedAt: reviewClass.nightlyReviewRequestedAt,
        complete: !classIncomplete,
        summary: { ...classSummary },
        error: null,
      })
      if (!finished) throw new Error('Nightly review lease was lost')
      activeClass = null
      activeClassSummary = null
    }
    return { acquired: true, summary }
  } catch (error) {
    if (activeClass && activeClassSummary) {
      try {
        await options.repository.failClassRun({
          owner: options.owner,
          classId: activeClass.id,
          scheduleHour: activeClass.nightlyReviewHour,
          scheduleTimezone: activeClass.nightlyReviewTimezone,
          summary: { ...activeClassSummary },
          error: 'Nightly review tick failed',
        })
      } catch {
        // Preserve the original failure; the daemon will retry and report it.
      }
    }
    throw error
  } finally {
    await options.repository.releaseLease(options.owner)
  }
}
