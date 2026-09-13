export const MAX_TEAM_NOTE_LENGTH = 20_000

type Principal = { id: string; role: string }
type ReadContext = {
  hasClass: boolean
  classMemberUserIds: string[]
  teamMemberUserIds?: string[]
}
type WriteContext = { teamMemberUserIds: string[]; archived: boolean }

export function canReadTeamNote(principal: Principal, context: ReadContext): boolean {
  if (principal.role === 'ADMIN' || principal.role === 'OBSERVER') return true
  return context.hasClass
    ? context.classMemberUserIds.includes(principal.id)
    : (context.teamMemberUserIds ?? []).includes(principal.id)
}

export function canWriteTeamNote(principal: Principal, context: WriteContext): boolean {
  if (context.archived || principal.role === 'OBSERVER') return false
  return principal.role === 'ADMIN' || context.teamMemberUserIds.includes(principal.id)
}

export function validateTeamNoteContent(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Team note content must be a string')
  const content = value.trim()
  if (content.length > MAX_TEAM_NOTE_LENGTH) {
    throw new Error(`Team note content must be at most ${MAX_TEAM_NOTE_LENGTH} characters`)
  }
  return content
}

export function parseExpectedRevision(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error('A non-negative integer revision is required')
  }
  return value as number
}
