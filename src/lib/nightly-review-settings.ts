export interface NightlyReviewDraft {
  enabled: boolean
  hour: number
  timeZone: string
}

export function defaultNightlyReviewSettings(): NightlyReviewDraft {
  return { enabled: false, hour: 2, timeZone: 'America/Los_Angeles' }
}

export function validateNightlyReviewDraft(draft: NightlyReviewDraft): string | null {
  if (!Number.isInteger(draft.hour) || draft.hour < 0 || draft.hour > 23) {
    return 'Review hour must be a whole number from 0 through 23.'
  }
  if (!draft.timeZone.trim()) return 'A time zone is required.'
  return null
}
