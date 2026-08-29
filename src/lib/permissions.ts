/**
 * Central authorization for Sanctum Kanban.
 *
 * One `can()` function is the single source of truth for who may do what,
 * used by BOTH the API routes (enforcement) and the UI (to hide/disable
 * controls). Previously these rules were duplicated inline in every route,
 * which is how bugs like "members cannot create tickets" crept in.
 *
 * Role model:
 *   ADMIN     - full control over everything
 *   TEAM_LEAD - full control within teams they lead; read-only elsewhere
 *   MEMBER    - create/edit within their own team(s); read-only elsewhere
 *   OBSERVER  - read-only everywhere EXCEPT individual student reports;
 *               a guest identity that needs no real account/password
 */

export type Role = 'ADMIN' | 'TEAM_LEAD' | 'MEMBER' | 'OBSERVER'

export interface Principal {
  id: string
  role: Role
}

/** Membership facts about the resource's team, resolved by the caller. */
export interface TeamContext {
  /** Is the principal a member (any role) of the resource's team? */
  isMember?: boolean
  /** Is the principal the LEAD of the resource's team? */
  isLead?: boolean
}

/** Facts about a specific ticket, resolved by the caller. */
export interface TicketContext extends TeamContext {
  assigneeId?: string | null
  createdById?: string | null
}

export type Action =
  // boards / tickets
  | 'ticket:read'
  | 'ticket:create'
  | 'ticket:update'
  | 'ticket:archive'
  | 'ticket:delete-hard'
  | 'ticket:comment'
  // reflections & dcwf
  | 'reflection:write'
  | 'dcwf:link'
  // reports
  | 'report:view-own'
  | 'report:view-any'
  // admin surfaces
  | 'admin:access'
  | 'team:manage'

export const isObserver = (p?: Principal | null) => p?.role === 'OBSERVER'
export const isAdmin = (p?: Principal | null) => p?.role === 'ADMIN'

/**
 * The authoritative capability check.
 *
 * @param p    the acting principal (null = fully unauthenticated)
 * @param action  what they want to do
 * @param ctx  resolved facts about the target resource (team/ticket)
 */
export function can(
  p: Principal | null | undefined,
  action: Action,
  ctx: TicketContext = {}
): boolean {
  if (!p) return false
  const admin = p.role === 'ADMIN'
  if (admin) return true // admin can do everything

  const observer = p.role === 'OBSERVER'
  const lead = !!ctx.isLead
  const member = !!ctx.isMember
  const assignee = ctx.assigneeId != null && ctx.assigneeId === p.id
  const creator = ctx.createdById != null && ctx.createdById === p.id

  switch (action) {
    // Everyone authenticated (including observer) can READ any board/ticket.
    case 'ticket:read':
      return true

    // Observers never write.
    case 'ticket:create':
      // Any member of THAT team may create a ticket in it.
      return !observer && member

    case 'ticket:update':
      // Lead of the team, or the ticket's assignee/creator.
      return !observer && (lead || assignee || creator)

    case 'ticket:archive':
      // Soft-delete: lead of the team, or the creator of the ticket.
      return !observer && (lead || creator)

    case 'ticket:delete-hard':
      // Permanent deletion is admin-only (handled by the admin shortcut above).
      return false

    case 'ticket:comment':
    case 'reflection:write':
    case 'dcwf:link':
      // Contribute within your own team only.
      return !observer && member

    case 'report:view-own':
      return !observer // observers cannot see individual reports

    case 'report:view-any':
      // Team leads may view reports for their team members; enforced with
      // team context. Observers never; members only their own (use -own).
      return !observer && lead

    case 'admin:access':
    case 'team:manage':
      return false // admin-only, already returned true above

    default:
      return false
  }
}

/** Convenience: does this principal have any write capability at all? */
export function isReadOnly(p?: Principal | null): boolean {
  return !p || p.role === 'OBSERVER'
}
