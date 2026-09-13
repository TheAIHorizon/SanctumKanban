/** Global labels belong in every team's filter and create/edit pickers. */
export function withGlobalTags<Team extends { tags: unknown[] }>(teams: Team[], globalTags: Team['tags']): Team[] {
  return teams.map(team => ({ ...team, tags: [...globalTags, ...team.tags] }))
}
