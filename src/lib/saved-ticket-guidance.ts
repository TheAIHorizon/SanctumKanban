export function canReadSavedGuidance(role: string, isCurrentTeamMember: boolean): boolean {
  return role === 'ADMIN' || (role !== 'OBSERVER' && isCurrentTeamMember)
}

export function guidanceDraftLabel(isCurrent: boolean): string {
  return isCurrent ? 'Current saved review' : 'Older draft review'
}
