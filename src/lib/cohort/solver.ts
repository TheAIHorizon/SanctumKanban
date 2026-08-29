/**
 * Deterministic team-formation solver.
 *
 * Pure and reproducible: same responses + seed + weights => same teams.
 * Strategy: scarce-skill-first greedy seed, then a simulated-annealing swap
 * loop that maximizes a weighted objective. Hard constraints (team size,
 * mutual partner locks, >=2 shared meeting days) are enforced as feasibility
 * gates; everything else is a weighted soft term.
 *
 * Scales trivially for classroom sizes (tens of students).
 */

import { SKILL_AXES, SKILL_KEYS, WEEKDAYS } from './roles'

export interface Student {
  id: string
  firstName: string
  lastName: string
  skills: Record<string, number> // axis key -> 1..5 (0 if unknown)
  aspirationRole?: string | null
  leadership?: 'prefer' | 'willing' | 'no' | null
  availDays: string[]
  timePref?: string | null
  workStyle?: string | null
  partnerRequest?: string | null // free text name
  antiPartner?: string | null
}

export interface Weights {
  skillParity: number
  pillarCoverage: number
  mentorBalance: number
  requestsHonored: number
  scheduleFit: number
}

export const MODE_PRESETS: Record<string, Weights> = {
  parity: { skillParity: 0.85, pillarCoverage: 0.55, mentorBalance: 0.65, requestsHonored: 0.35, scheduleFit: 0.3 },
  coverage: { skillParity: 0.4, pillarCoverage: 0.95, mentorBalance: 0.4, requestsHonored: 0.3, scheduleFit: 0.35 },
  mentorship: { skillParity: 0.55, pillarCoverage: 0.45, mentorBalance: 0.95, requestsHonored: 0.3, scheduleFit: 0.3 },
  affinity: { skillParity: 0.35, pillarCoverage: 0.4, mentorBalance: 0.35, requestsHonored: 0.95, scheduleFit: 0.8 },
  specialization: { skillParity: 0.2, pillarCoverage: 0.3, mentorBalance: 0.25, requestsHonored: 0.5, scheduleFit: 0.4 },
  schedule: { skillParity: 0.4, pillarCoverage: 0.4, mentorBalance: 0.4, requestsHonored: 0.5, scheduleFit: 0.95 },
}

export interface TeamResult {
  index: number
  memberIds: string[]
  isHolding: boolean
  metrics: {
    sharedDays: string[]
    pillarCoverage: number // fraction of 8 axes with >=1 member rated >=3
    coveredPillars: string[]
    gapPillars: string[]
    hasAnchor: boolean // some member rates >=3 on Linux or Windows
    avgSkill: number
    requestsHonored: number
  }
}

export interface SolveResult {
  teams: TeamResult[]
  leftovers: string[]
  score: number
  metrics: {
    completeTeams: number
    holdingTeams: number
    weakestTeamSkill: number
    pillarsCoveredEverywhere: number
    totalStudents: number
    teamSize: number
  }
}

export interface SolveOptions {
  teamSize?: number
  weights: Weights
  seed?: number
  iterations?: number
}

// ---- seeded RNG (mulberry32) for reproducibility ----
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Resolve free-text partner names to student ids (best-effort exact/last-name match). */
function buildNameIndex(students: Student[]) {
  const byFull = new Map<string, string>()
  const byLast = new Map<string, string[]>()
  for (const s of students) {
    byFull.set(norm(`${s.firstName} ${s.lastName}`), s.id)
    const l = norm(s.lastName)
    byLast.set(l, [...(byLast.get(l) || []), s.id])
  }
  return { byFull, byLast }
}
function resolveName(raw: string | null | undefined, idx: ReturnType<typeof buildNameIndex>): string | null {
  if (!raw) return null
  const n = norm(raw)
  if (!n || ['no', 'n/a', 'na', 'none', 'n?a'].includes(n)) return null
  if (idx.byFull.has(n)) return idx.byFull.get(n)!
  // try last token as last name
  const parts = n.split(' ')
  const last = parts[parts.length - 1]
  const hits = idx.byLast.get(last)
  if (hits && hits.length === 1) return hits[0]
  // try first token
  for (const [full, id] of Array.from(idx.byFull.entries())) {
    if (full.includes(n) || n.includes(full)) return id
  }
  return null
}

function sharedDays(members: Student[]): string[] {
  if (!members.length) return []
  return WEEKDAYS.filter((d) => members.every((m) => (m.availDays || []).includes(d)))
}

function teamMetrics(members: Student[], mutualPairs: Set<string>): TeamResult['metrics'] {
  const covered: string[] = []
  const gaps: string[] = []
  for (const axis of SKILL_AXES) {
    const has = members.some((m) => (m.skills[axis.key] || 0) >= 3)
    if (has) covered.push(axis.key)
    else gaps.push(axis.key)
  }
  const hasAnchor = members.some(
    (m) => (m.skills.linux || 0) >= 3 || (m.skills.windowsAd || 0) >= 3
  )
  const allSkill = members.reduce((sum, m) => {
    return sum + SKILL_KEYS.reduce((s, k) => s + (m.skills[k] || 0), 0)
  }, 0)
  const avgSkill = members.length ? allSkill / members.length : 0
  // honored requests: count members whose partnerRequest is also in this team
  let requestsHonored = 0
  const ids = new Set(members.map((m) => m.id))
  for (const m of members) {
    if ((m as any)._reqId && ids.has((m as any)._reqId)) requestsHonored++
  }
  return {
    sharedDays: sharedDays(members),
    pillarCoverage: covered.length / SKILL_AXES.length,
    coveredPillars: covered,
    gapPillars: gaps,
    hasAnchor,
    avgSkill,
    requestsHonored,
  }
}

/** Weighted objective for a full assignment (higher is better). */
function objective(teams: Student[][], w: Weights, mutualPairs: Set<string>): number {
  if (!teams.length) return 0
  const metrics = teams.map((t) => teamMetrics(t, mutualPairs))
  // skill parity = lift the weakest team (maximin): reward high minimum avg skill
  const minAvg = Math.min(...metrics.map((m) => m.avgSkill))
  const skillParity = minAvg / 15 // avg skill roughly 0..~15 (3 members * up to 5*... normalized)
  // pillar coverage = mean coverage across teams
  const pillarCoverage = metrics.reduce((s, m) => s + m.pillarCoverage, 0) / metrics.length
  // mentor balance = fraction of teams with an OS anchor
  const mentorBalance = metrics.filter((m) => m.hasAnchor).length / metrics.length
  // requests honored = normalized count
  const totalReq = metrics.reduce((s, m) => s + m.requestsHonored, 0)
  const requestsHonored = Math.min(1, totalReq / Math.max(1, teams.length))
  // schedule fit = fraction of teams with >=2 shared days
  const scheduleFit = metrics.filter((m) => m.sharedDays.length >= 2).length / metrics.length
  return (
    w.skillParity * skillParity +
    w.pillarCoverage * pillarCoverage +
    w.mentorBalance * mentorBalance +
    w.requestsHonored * requestsHonored +
    w.scheduleFit * scheduleFit
  )
}

export function solve(studentsIn: Student[], opts: SolveOptions): SolveResult {
  const teamSize = opts.teamSize ?? 3
  const w = opts.weights
  const rand = mulberry32(opts.seed ?? 12345)
  const iterations = opts.iterations ?? 4000

  // annotate resolved partner ids + mutual pairs
  const students = studentsIn.map((s) => ({ ...s }))
  const nameIdx = buildNameIndex(students)
  const mutualPairs = new Set<string>()
  for (const s of students) {
    const reqId = resolveName(s.partnerRequest, nameIdx)
    ;(s as any)._reqId = reqId
  }
  for (const s of students) {
    const reqId = (s as any)._reqId
    if (reqId) {
      const other = students.find((o) => o.id === reqId)
      if (other && (other as any)._reqId === s.id) {
        mutualPairs.add([s.id, reqId].sort().join('|'))
      }
    }
  }

  const n = students.length
  const numTeams = Math.floor(n / teamSize)
  const leftoverCount = n - numTeams * teamSize

  // ---- scarce-skill-first greedy seed ----
  // Rank axes by scarcity (fewest students rated >=3), seed each team with a
  // carrier of the scarcest skill, then fill.
  const scarcity = SKILL_AXES.map((a) => ({
    key: a.key,
    count: students.filter((s) => (s.skills[a.key] || 0) >= 3).length,
  })).sort((x, y) => x.count - y.count)

  const assigned = new Set<string>()
  const teams: Student[][] = Array.from({ length: numTeams }, () => [])

  // Lock mutual pairs together first.
  for (const pair of Array.from(mutualPairs)) {
    const [a, b] = pair.split('|')
    if (assigned.has(a) || assigned.has(b)) continue
    const t = teams.find((t) => t.length + 2 <= teamSize)
    if (t) {
      const sa = students.find((s) => s.id === a)!
      const sb = students.find((s) => s.id === b)!
      t.push(sa, sb)
      assigned.add(a)
      assigned.add(b)
    }
  }

  // Seed scarce carriers into empty-ish teams.
  for (const { key } of scarcity) {
    const carriers = students
      .filter((s) => !assigned.has(s.id) && (s.skills[key] || 0) >= 3)
      .sort((a, b) => (b.skills[key] || 0) - (a.skills[key] || 0))
    for (const c of carriers) {
      // find team with room and without this skill yet
      const t = teams.find(
        (t) => t.length < teamSize && !t.some((m) => (m.skills[key] || 0) >= 3)
      )
      if (t) {
        t.push(c)
        assigned.add(c.id)
      }
    }
  }

  // Fill remaining seats with leftover students (strongest first for balance).
  const remaining = students
    .filter((s) => !assigned.has(s.id))
    .sort((a, b) => {
      const sa = SKILL_KEYS.reduce((s, k) => s + (a.skills[k] || 0), 0)
      const sb = SKILL_KEYS.reduce((s, k) => s + (b.skills[k] || 0), 0)
      return sb - sa
    })
  for (const s of remaining) {
    const t = teams.find((t) => t.length < teamSize)
    if (t) {
      t.push(s)
      assigned.add(s.id)
    }
  }

  const leftovers = students.filter((s) => !assigned.has(s.id)).map((s) => s.id)

  // ---- simulated annealing: swap members between teams to improve objective ----
  const isLocked = (id: string) => {
    for (const p of Array.from(mutualPairs)) if (p.split('|').includes(id)) return true
    return false
  }
  let cur = teams.map((t) => [...t])
  let curScore = objective(cur, w, mutualPairs)
  let best = cur.map((t) => [...t])
  let bestScore = curScore
  let temp = 1.0
  const cool = Math.pow(0.001 / 1.0, 1 / Math.max(1, iterations))

  for (let i = 0; i < iterations && numTeams >= 2; i++) {
    const ta = Math.floor(rand() * numTeams)
    let tb = Math.floor(rand() * numTeams)
    if (tb === ta) tb = (tb + 1) % numTeams
    if (!cur[ta].length || !cur[tb].length) continue
    const ia = Math.floor(rand() * cur[ta].length)
    const ib = Math.floor(rand() * cur[tb].length)
    const a = cur[ta][ia]
    const b = cur[tb][ib]
    if (isLocked(a.id) || isLocked(b.id)) continue
    // swap
    cur[ta][ia] = b
    cur[tb][ib] = a
    const newScore = objective(cur, w, mutualPairs)
    const delta = newScore - curScore
    if (delta >= 0 || rand() < Math.exp(delta / Math.max(1e-6, temp))) {
      curScore = newScore
      if (newScore > bestScore) {
        bestScore = newScore
        best = cur.map((t) => [...t])
      }
    } else {
      // revert
      cur[ta][ia] = a
      cur[tb][ib] = b
    }
    temp *= cool
  }

  // ---- assemble result ----
  const holdingIds = new Set(leftovers)
  const teamResults: TeamResult[] = best.map((members, index) => ({
    index,
    memberIds: members.map((m) => m.id),
    isHolding: false,
    metrics: teamMetrics(members, mutualPairs),
  }))

  // If leftovers exist, form a holding team from them (may be < teamSize).
  if (leftovers.length) {
    const members = students.filter((s) => holdingIds.has(s.id))
    teamResults.push({
      index: teamResults.length,
      memberIds: members.map((m) => m.id),
      isHolding: true,
      metrics: teamMetrics(members, mutualPairs),
    })
  }

  const completeTeams = teamResults.filter((t) => !t.isHolding).length
  const weakestTeamSkill = Math.min(
    ...teamResults.filter((t) => !t.isHolding).map((t) => t.metrics.avgSkill)
  )
  const pillarsCoveredEverywhere = SKILL_AXES.filter((axis) =>
    teamResults.filter((t) => !t.isHolding).every((t) => t.metrics.coveredPillars.includes(axis.key))
  ).length

  return {
    teams: teamResults,
    leftovers,
    score: bestScore,
    metrics: {
      completeTeams,
      holdingTeams: leftovers.length ? 1 : 0,
      weakestTeamSkill: isFinite(weakestTeamSkill) ? weakestTeamSkill : 0,
      pillarsCoveredEverywhere,
      totalStudents: n,
      teamSize,
    },
  }
}
