export type ViewerRole = 'ADMIN' | 'TEAM_LEAD' | 'MEMBER' | 'OBSERVER' | string

export function canReadTeamFeedback(role: ViewerRole, isCurrentTeamMember: boolean): boolean {
  return role === 'ADMIN' || (role !== 'OBSERVER' && isCurrentTeamMember)
}

type DatedReply = { createdAt: string }
type DatedPost<TReply extends DatedReply> = { createdAt: string; replies: TReply[]; pinned?: boolean }

export function sortFeedbackChronologically<TReply extends DatedReply, TPost extends DatedPost<TReply>>(
  posts: readonly TPost[]
): TPost[] {
  return [...posts]
    .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) || Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .map(post => ({
      ...post,
      replies: [...post.replies].sort(
        (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
      ),
    }))
}
