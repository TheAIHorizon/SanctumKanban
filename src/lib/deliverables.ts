export const REQUIRED_TAG = 'Required'
export const BONUS_EXTRA_TAG = 'Bonus / Extra'
export const MAX_DELIVERABLES = 50
export const MAX_DELIVERABLE_TITLE_LENGTH = 200
export const MAX_DELIVERABLE_DESCRIPTION_LENGTH = 5000

export type DeliverableKind = 'required' | 'bonus'

export interface DeliverableInput {
  title: string
  description: string | null
  kind: DeliverableKind
}

interface TeamRef {
  id: string
}

interface ExistingTaggedTicket {
  teamId: string
  title: string
  tagName: string | null
}

export interface PlannedDeliverable {
  teamId: string
  deliverable: DeliverableInput
}

export function normalizeDeliverableTitle(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

export function workflowTagFor(kind: DeliverableKind): typeof REQUIRED_TAG | typeof BONUS_EXTRA_TAG {
  return kind === 'required' ? REQUIRED_TAG : BONUS_EXTRA_TAG
}

export function parseDeliverablesInput(body: unknown): DeliverableInput[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { deliverables?: unknown }).deliverables)) {
    throw new Error('Deliverables must be an array')
  }

  const values = (body as { deliverables: unknown[] }).deliverables
  if (values.length < 1) throw new Error('Provide at least one deliverable')
  if (values.length > MAX_DELIVERABLES) {
    throw new Error(`No more than ${MAX_DELIVERABLES} deliverables may be distributed at once`)
  }

  const seen = new Set<string>()
  return values.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Deliverable ${index + 1} is invalid`)
    const candidate = value as { title?: unknown; description?: unknown; kind?: unknown }
    if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
      throw new Error(`Deliverable ${index + 1} needs a title`)
    }
    const title = candidate.title.trim()
    if (title.length > MAX_DELIVERABLE_TITLE_LENGTH) {
      throw new Error(`Deliverable titles cannot exceed ${MAX_DELIVERABLE_TITLE_LENGTH} characters`)
    }
    if (candidate.kind !== 'required' && candidate.kind !== 'bonus') {
      throw new Error(`Deliverable ${index + 1} must be required or bonus`)
    }
    if (candidate.description !== undefined && candidate.description !== null && typeof candidate.description !== 'string') {
      throw new Error(`Deliverable ${index + 1} has an invalid description`)
    }
    const description = typeof candidate.description === 'string' ? candidate.description.trim() : ''
    if (description.length > MAX_DELIVERABLE_DESCRIPTION_LENGTH) {
      throw new Error(`Deliverable descriptions cannot exceed ${MAX_DELIVERABLE_DESCRIPTION_LENGTH} characters`)
    }

    const normalizedTitle = normalizeDeliverableTitle(title)
    if (seen.has(normalizedTitle)) throw new Error('Deliverable titles must be unique in a distribution')
    seen.add(normalizedTitle)

    return { title, description: description || null, kind: candidate.kind }
  })
}

export function planDeliverableDistribution(
  teams: readonly TeamRef[],
  deliverables: readonly DeliverableInput[],
  existingTickets: readonly ExistingTaggedTicket[]
): { create: PlannedDeliverable[]; skipped: number } {
  const existing = new Set(
    existingTickets
      .filter((ticket) => ticket.tagName === REQUIRED_TAG || ticket.tagName === BONUS_EXTRA_TAG)
      .map((ticket) => `${ticket.teamId}\u0000${ticket.tagName}\u0000${normalizeDeliverableTitle(ticket.title)}`)
  )
  const create: PlannedDeliverable[] = []
  let skipped = 0

  for (const team of teams) {
    for (const deliverable of deliverables) {
      const key = `${team.id}\u0000${workflowTagFor(deliverable.kind)}\u0000${normalizeDeliverableTitle(deliverable.title)}`
      if (existing.has(key)) {
        skipped += 1
      } else {
        create.push({ teamId: team.id, deliverable })
      }
    }
  }

  return { create, skipped }
}
