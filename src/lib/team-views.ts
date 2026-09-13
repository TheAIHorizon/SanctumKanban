interface TeamMemberships {
  members: { userId: string }[]
}

/** Stable membership-first ordering; My Teams is membership-based for every role. */
export function teamsForView<T extends TeamMemberships>(teams: T[], userId: string, mineOnly: boolean): T[] {
  const mine = teams.filter(team => team.members.some(member => member.userId === userId))
  if (mineOnly) return mine
  return [...mine, ...teams.filter(team => !team.members.some(member => member.userId === userId))]
}
