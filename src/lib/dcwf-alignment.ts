/**
 * DCWF work-role alignment engine.
 *
 * Given the DCWF Tasks a user has logged (via TicketDcwfTask links), compute
 * which work roles their work aligns to, and roll that up to DCWF Elements.
 *
 * Scoring: each (task -> work role) mapping contributes a weight based on
 * whether the task is Core/Additional for that role. A task that is "Core" to
 * a role is stronger evidence the person is doing that role than an "Additional"
 * task. Weights are a first cut and intentionally simple.
 */
import { prisma } from '@/lib/prisma'

export const ROLE_WEIGHTS: Record<string, number> = {
  Core: 2,
  Additional: 1,
  Unassigned: 0.5,
}
const DEFAULT_WEIGHT = 1

export interface RoleAlignment {
  code: string
  title: string
  element: string | null
  inScope: boolean
  score: number
  percent: number // share of total score across all roles
  taskCount: number // distinct logged tasks that hit this role
  coreCount: number // of those, how many were Core to this role
}

export interface ElementAlignment {
  name: string
  score: number
  percent: number
  roleCount: number
}

export interface AlignmentResult {
  totalTasksLogged: number // distinct DCWF tasks the user logged (in scope of the query)
  totalScore: number
  roles: RoleAlignment[] // ranked desc by score
  elements: ElementAlignment[] // ranked desc by score
}

/** One logged task with its role mappings — the shape the pure scorer needs. */
export interface LoggedTaskMapping {
  ksatDbId: string
  roleMappings: {
    code: string
    title: string
    element: string | null
    inScope: boolean
    coreOrAdditional: string | null
  }[]
}

/**
 * Pure scoring function — no DB. Exported for unit testing.
 * Deduplicates tasks by ksatDbId so linking the same DCWF task on two tickets
 * doesn't double-count.
 */
export function scoreAlignment(tasks: LoggedTaskMapping[]): AlignmentResult {
  const seen = new Set<string>()
  const roleAgg = new Map<
    string,
    { title: string; element: string | null; inScope: boolean; score: number; taskCount: number; coreCount: number }
  >()

  let distinctTasks = 0
  for (const t of tasks) {
    if (seen.has(t.ksatDbId)) continue
    seen.add(t.ksatDbId)
    distinctTasks++

    for (const m of t.roleMappings) {
      const w = m.coreOrAdditional ? ROLE_WEIGHTS[m.coreOrAdditional] ?? DEFAULT_WEIGHT : DEFAULT_WEIGHT
      const cur =
        roleAgg.get(m.code) ||
        { title: m.title, element: m.element, inScope: m.inScope, score: 0, taskCount: 0, coreCount: 0 }
      cur.score += w
      cur.taskCount += 1
      if (m.coreOrAdditional === 'Core') cur.coreCount += 1
      roleAgg.set(m.code, cur)
    }
  }

  const totalScore = Array.from(roleAgg.values()).reduce((s, r) => s + r.score, 0)

  const roles: RoleAlignment[] = Array.from(roleAgg.entries())
    .map(([code, r]) => ({
      code,
      title: r.title,
      element: r.element,
      inScope: r.inScope,
      score: r.score,
      percent: totalScore > 0 ? (r.score / totalScore) * 100 : 0,
      taskCount: r.taskCount,
      coreCount: r.coreCount,
    }))
    .sort((a, b) => b.score - a.score || b.taskCount - a.taskCount)

  // Roll up to elements
  const elAgg = new Map<string, { score: number; roleCount: number }>()
  for (const r of roles) {
    const key = r.element || 'Unassigned'
    const cur = elAgg.get(key) || { score: 0, roleCount: 0 }
    cur.score += r.score
    cur.roleCount += 1
    elAgg.set(key, cur)
  }
  const elements: ElementAlignment[] = Array.from(elAgg.entries())
    .map(([name, e]) => ({
      name,
      score: e.score,
      percent: totalScore > 0 ? (e.score / totalScore) * 100 : 0,
      roleCount: e.roleCount,
    }))
    .sort((a, b) => b.score - a.score)

  return { totalTasksLogged: distinctTasks, totalScore, roles, elements }
}

export interface AlignmentQuery {
  userId: string
  teamId?: string
  from?: Date
  to?: Date
  inScopeOnly?: boolean
}

/**
 * DB-backed alignment: gather the user's logged DCWF tasks (optionally scoped by
 * team / date), then score them against the role mapping.
 *
 * "The user's logged tasks" = TicketDcwfTask links they created OR links on
 * tickets assigned to them (so a lead logging on a member's behalf still counts
 * toward the member when they're the assignee). We attribute by createdById to
 * reflect who did the reflection; adjust here if attribution should change.
 */
export async function computeAlignment(q: AlignmentQuery): Promise<AlignmentResult> {
  const where: any = { createdById: q.userId }
  if (q.from || q.to) {
    where.createdAt = {}
    if (q.from) where.createdAt.gte = q.from
    if (q.to) where.createdAt.lte = q.to
  }
  if (q.teamId) {
    where.ticket = { teamId: q.teamId }
  }

  const links = await prisma.ticketDcwfTask.findMany({
    where,
    select: {
      ksat: {
        select: {
          id: true,
          roles: {
            select: {
              coreOrAdditional: true,
              workRole: {
                select: {
                  code: true,
                  title: true,
                  inScope: true,
                  element: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const tasks: LoggedTaskMapping[] = links.map((l) => ({
    ksatDbId: l.ksat.id,
    roleMappings: l.ksat.roles
      .filter((r) => (q.inScopeOnly ? r.workRole.inScope : true))
      .map((r) => ({
        code: r.workRole.code,
        title: r.workRole.title,
        element: r.workRole.element?.name ?? null,
        inScope: r.workRole.inScope,
        coreOrAdditional: r.coreOrAdditional,
      })),
  }))

  return scoreAlignment(tasks)
}
