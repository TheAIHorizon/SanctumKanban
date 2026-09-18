export function formatRunSummary(value: unknown): string | null {
  if (value == null) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function hasPendingReview(value: Record<string, unknown>): boolean {
  return typeof value.pending === 'boolean' ? value.pending : Boolean(value.nightlyReviewRequestedAt)
}
