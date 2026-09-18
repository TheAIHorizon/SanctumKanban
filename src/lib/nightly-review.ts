import { createHash } from 'node:crypto'

export const NIGHTLY_REVIEW_MODEL = 'laguna-s'
export const NIGHTLY_PROMPT_VERSION = 'dcwf-coach-v1'
export const DEFAULT_NIGHTLY_BATCH_SIZE = 50
export const MAX_NIGHTLY_BATCH_SIZE = 50
export const NIGHTLY_RETRY_MS = 24 * 60 * 60 * 1000

export interface NightlyHashInput {
  title: string
  description: string | null
  model: string
  promptVersion: string
}

export function computeNightlyInputHash(input: NightlyHashInput): string {
  return createHash('sha256').update(JSON.stringify({
    title: input.title,
    description: input.description ?? '',
    model: input.model,
    promptVersion: input.promptVersion,
  })).digest('hex')
}

export function validateTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

function localParts(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
  }
}

export function localScheduleDate(now: Date, timeZone: string): string {
  return localParts(now, timeZone).date
}

function storedRunDate(value: string | Date | null): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export interface NightlySchedule {
  nightlyReviewEnabled: boolean
  archivedAt: Date | null
  nightlyReviewHour: number
  nightlyReviewTimezone: string
  nightlyReviewRequestedAt: Date | null
  nightlyReviewLastRunAt: Date | null
  nightlyReviewLastRunDate: string | Date | null
}

/** DST-safe catch-up: after the configured local hour, run once for that local date. */
export function isNightlyReviewDue(schedule: NightlySchedule, now: Date): boolean {
  if (!schedule.nightlyReviewEnabled || schedule.archivedAt) return false
  if (!validateTimeZone(schedule.nightlyReviewTimezone)) return false
  if (schedule.nightlyReviewRequestedAt) return true

  const local = localParts(now, schedule.nightlyReviewTimezone)
  return local.hour >= schedule.nightlyReviewHour && storedRunDate(schedule.nightlyReviewLastRunDate) !== local.date
}

export interface NightlySettingsPatch {
  nightlyReviewEnabled?: boolean
  nightlyReviewHour?: number
  nightlyReviewTimezone?: string
}

export function parseNightlySettingsPatch(value: unknown): NightlySettingsPatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const allowed = new Set(['enabled', 'hour', 'timeZone'])
  if (Object.keys(body).some((key) => !allowed.has(key))) return null
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return null
  if (body.hour !== undefined && (!Number.isInteger(body.hour) || (body.hour as number) < 0 || (body.hour as number) > 23)) return null
  if (body.timeZone !== undefined && (typeof body.timeZone !== 'string' || !validateTimeZone(body.timeZone))) return null
  if (body.enabled === undefined && body.hour === undefined && body.timeZone === undefined) return null
  return {
    ...(body.enabled !== undefined ? { nightlyReviewEnabled: body.enabled as boolean } : {}),
    ...(body.hour !== undefined ? { nightlyReviewHour: body.hour as number } : {}),
    ...(body.timeZone !== undefined ? { nightlyReviewTimezone: body.timeZone as string } : {}),
  }
}

export function normalizeBatchSize(value: number | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1 || value > MAX_NIGHTLY_BATCH_SIZE) {
    return DEFAULT_NIGHTLY_BATCH_SIZE
  }
  return value
}
