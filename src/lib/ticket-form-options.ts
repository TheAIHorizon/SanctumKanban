/** The select's placeholder value is not a database user ID. */
export function assigneeFromSelection(value: string): string | null {
  return value === '' || value === 'unassigned' ? null : value
}

export function canFilterMyTickets(members: { userId: string }[], userId: string): boolean {
  return members.some(member => member.userId === userId)
}
