export interface TicketSchedule {
  startDate: Date | null
  dueDate: Date | null
  /** True only when the server supplied startDate on first actual start. */
  startDateAutoFilled?: boolean
}

export interface TicketScheduleInput {
  startDate?: unknown
  dueDate?: unknown
}

export type TicketScheduleValidation =
  | {
      ok: true
      /** The existing schedule merged with any provided fields. */
      schedule: TicketSchedule
      /** Only fields explicitly present in the input, ready for a Prisma update. */
      updates: Partial<TicketSchedule>
    }
  | {
      ok: false
      error: string
    }

const ISO_TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function parseStartDate(value: unknown): Date | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  return parseDateOnly(value) ?? undefined
}

function parseDueDate(value: unknown): Date | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const dateOnly = parseDateOnly(value)
  if (dateOnly) return dateOnly

  // Compatibility policy: dueDate continues to accept the timezone-qualified
  // ISO timestamps supported by existing API clients. Date-only values from
  // the editors are normalized to UTC midnight; loose/local timestamps are
  // rejected so parsing never depends on the server timezone.
  if (!ISO_TIMESTAMP_WITH_ZONE.test(value)) return undefined
  if (!parseDateOnly(value.slice(0, 10))) return undefined
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function validateTicketSchedule(
  input: TicketScheduleInput,
  existing: TicketSchedule,
): TicketScheduleValidation {
  const updates: Partial<TicketSchedule> = {}
  const hasStartDate = Object.prototype.hasOwnProperty.call(input, 'startDate')
  const hasDueDate = Object.prototype.hasOwnProperty.call(input, 'dueDate')

  if (hasStartDate) {
    const startDate = parseStartDate(input.startDate)
    if (startDate === undefined) {
      return {
        ok: false,
        error: 'startDate must be null or a valid date in YYYY-MM-DD format',
      }
    }
    updates.startDate = startDate
  }

  if (hasDueDate) {
    const dueDate = parseDueDate(input.dueDate)
    if (dueDate === undefined) {
      return {
        ok: false,
        error: 'dueDate must be null, a valid YYYY-MM-DD date, or a timezone-qualified ISO timestamp',
      }
    }
    updates.dueDate = dueDate
  }

  const schedule: TicketSchedule = {
    startDate: hasStartDate ? updates.startDate! : existing.startDate,
    dueDate: hasDueDate ? updates.dueDate! : existing.dueDate,
  }

  const unchangedAutomaticStart = Boolean(
    existing.startDateAutoFilled &&
    schedule.startDate !== null &&
    existing.startDate !== null &&
    schedule.startDate.getTime() === existing.startDate.getTime()
  )

  if (
    schedule.startDate !== null &&
    schedule.dueDate !== null &&
    schedule.startDate.getTime() > schedule.dueDate.getTime() &&
    !unchangedAutomaticStart
  ) {
    return {
      ok: false,
      error: 'startDate must be on or before dueDate',
    }
  }

  return { ok: true, schedule, updates }
}
