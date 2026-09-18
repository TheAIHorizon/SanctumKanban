export type FeedbackPrincipal = {
  id: string
  role: string
}

export type FeedbackTeamContext = {
  teamMemberUserIds: readonly string[]
}

export type FeedbackWriteContext = FeedbackTeamContext & {
  archived: boolean
}

export function canReadInstructorFeedback(
  principal: FeedbackPrincipal,
  context: FeedbackTeamContext
): boolean {
  if (principal.role === 'ADMIN') return true
  if (principal.role === 'OBSERVER') return false
  return context.teamMemberUserIds.includes(principal.id)
}

export function canPostInstructorFeedback(
  principal: FeedbackPrincipal,
  context: FeedbackWriteContext
): boolean {
  return !context.archived && principal.role === 'ADMIN'
}

export const canPinInstructorFeedback = canPostInstructorFeedback

export function canReplyToInstructorFeedback(
  principal: FeedbackPrincipal,
  context: FeedbackWriteContext
): boolean {
  return !context.archived && canReadInstructorFeedback(principal, context)
}

export const canAcknowledgeInstructorFeedback = canReplyToInstructorFeedback

export const FEEDBACK_CATEGORIES = [
  'GUIDANCE',
  'NEEDS_ATTENTION',
  'ACTION_REQUIRED',
] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export const MAX_FEEDBACK_BODY_LENGTH = 5000
export const MAX_FEEDBACK_REPLY_LENGTH = 2000
const MAX_FEEDBACK_ID_LENGTH = 191

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Request body must be an object')
  }
  return value as Record<string, unknown>
}

function allowOnly(input: Record<string, unknown>, fields: readonly string[]): void {
  const unknown = Object.keys(input).find((key) => !fields.includes(key))
  if (unknown) throw new Error(`Unknown field: ${unknown}`)
}

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} is required`)
  if (trimmed.length > maximum) throw new Error(`${field} must be at most ${maximum} characters`)
  return trimmed
}

function boundedId(value: unknown, field: string): string {
  return boundedText(value, field, MAX_FEEDBACK_ID_LENGTH)
}

export type FeedbackPostInput = {
  body: string
  category: FeedbackCategory
  ticketId: string | null
  pinned: boolean
}

export function parseFeedbackPostInput(value: unknown): FeedbackPostInput {
  const input = requireRecord(value)
  allowOnly(input, ['body', 'category', 'ticketId', 'pinned'])
  const body = boundedText(input.body, 'body', MAX_FEEDBACK_BODY_LENGTH)
  if (!FEEDBACK_CATEGORIES.includes(input.category as FeedbackCategory)) {
    throw new Error('Invalid feedback category')
  }
  const ticketId = input.ticketId === undefined
    ? null
    : boundedId(input.ticketId, 'ticketId')
  if (input.pinned !== undefined && typeof input.pinned !== 'boolean') {
    throw new Error('pinned must be a boolean')
  }
  return {
    body,
    category: input.category as FeedbackCategory,
    ticketId,
    pinned: input.pinned ?? false,
  }
}

export function parseFeedbackReplyInput(value: unknown): { body: string } {
  const input = requireRecord(value)
  allowOnly(input, ['body'])
  return { body: boundedText(input.body, 'body', MAX_FEEDBACK_REPLY_LENGTH) }
}

export function parseAcknowledgeInput(value: unknown): Record<string, never> {
  const input = requireRecord(value)
  allowOnly(input, [])
  return {}
}

export function parsePinInput(value: unknown): { pinned: boolean } {
  const input = requireRecord(value)
  allowOnly(input, ['pinned'])
  if (typeof input.pinned !== 'boolean') throw new Error('pinned must be a boolean')
  return { pinned: input.pinned }
}

export function parseFeedbackReadInput(value: unknown): { throughId: string } {
  const input = requireRecord(value)
  allowOnly(input, ['throughId'])
  return { throughId: boundedId(input.throughId, 'throughId') }
}

type FeedbackListPost = {
  id: string
  body: string
  category: FeedbackCategory
  pinned: boolean
  createdAt: Date
  authorName: string
  ticket: { id: string; title: string } | null
  replies: Array<{ id: string; body: string; createdAt: Date; authorName: string }>
  acknowledgments: Array<{ userId: string; userName: string; createdAt: Date }>
}

export function serializeFeedbackList<T extends FeedbackListPost>(
  posts: readonly T[],
  userId: string,
  readThrough: Date | null
): { posts: Array<T & { acknowledgedByMe: boolean; isUnread: boolean }>; unreadCount: number } {
  const serialized = posts.map((post) => ({
    ...post,
    acknowledgedByMe: post.acknowledgments.some((acknowledgment) => acknowledgment.userId === userId),
    isUnread: !readThrough || post.createdAt > readThrough,
  }))
  return {
    posts: serialized,
    unreadCount: serialized.reduce((count, post) => count + (post.isUnread ? 1 : 0), 0),
  }
}
