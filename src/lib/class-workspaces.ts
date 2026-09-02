export interface ClassWorkspaceSummary {
  id: string
  name: string
  archivedAt: Date | string | null
  memberUserIds: string[]
}

export interface ClassWorkspacePrincipal {
  id: string
  role: string
}

/**
 * Class visibility is isolated by enrollment. Admins may browse every class;
 * other authenticated users only see classes in which they are enrolled.
 * Active and archived views are intentionally separate.
 */
export function visibleClassWorkspaces<T extends ClassWorkspaceSummary>(
  classes: T[],
  principal: ClassWorkspacePrincipal,
  archived: boolean
): T[] {
  return classes.filter((workspace) => {
    const isArchived = workspace.archivedAt != null
    if (isArchived !== archived) return false
    return (
      principal.role === 'ADMIN' ||
      principal.role === 'OBSERVER' ||
      workspace.memberUserIds.includes(principal.id)
    )
  })
}

/** Select the requested visible class, falling back to the first visible one. */
export function selectClassWorkspace<T extends ClassWorkspaceSummary>(
  visible: T[],
  requestedId?: string | null
): T | null {
  if (!visible.length) return null
  return visible.find((workspace) => workspace.id === requestedId) ?? visible[0]
}

/** Build the initial class roster from all legacy team memberships. */
export function legacyClassMemberIds(
  teams: { members: { userId: string }[] }[]
): string[] {
  return Array.from(
    new Set(teams.flatMap((team) => team.members.map((member) => member.userId)))
  ).sort()
}
