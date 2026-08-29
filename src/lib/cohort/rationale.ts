/**
 * Cohort rationale + watch-list generation.
 *
 * The solver produces the assignment and the numbers; this module produces the
 * NARRATIVE. AI (local Ollama by default) writes each team's "why these three"
 * and a cohort risk watch-list. Everything degrades gracefully: if AI is
 * unreachable, deterministic template rationales and a rule-based watch-list
 * are used instead, so the feature never blocks on the model.
 */

import { chat } from '../ai'
import { SKILL_AXES } from './roles'
import type { Student, SolveResult, TeamResult } from './solver'

const axisLabel = (key: string) => SKILL_AXES.find((a) => a.key === key)?.label || key

function studentBlurb(s: Student): string {
  const strong = SKILL_AXES.filter((a) => (s.skills[a.key] || 0) >= 3)
    .map((a) => `${a.label} ${s.skills[a.key]}`)
    .join(', ')
  return `${s.firstName} ${s.lastName} — strengths: ${strong || 'generalist'}; days: ${(s.availDays || []).join('/') || 'n/a'}`
}

/** Deterministic fallback rationale (no AI). */
export function templateRationale(team: TeamResult, students: Student[]): string {
  const members = team.memberIds.map((id) => students.find((s) => s.id === id)!).filter(Boolean)
  const names = members.map((m) => `${m.firstName} ${m.lastName}`).join(', ')
  const days = team.metrics.sharedDays.length
    ? team.metrics.sharedDays.join(', ')
    : 'no fully shared day'
  const gaps = team.metrics.gapPillars.map(axisLabel)
  const cover = Math.round(team.metrics.pillarCoverage * 100)
  let s = `${names}. Covers ${cover}% of capability areas; meets on ${days}.`
  if (team.metrics.hasAnchor) s += ' Has an operating-system anchor.'
  if (gaps.length) s += ` Coverage gap: ${gaps.join(', ')}.`
  if (team.isHolding) s += ' Holding team — awaiting additional member(s).'
  return s
}

/** Rule-based cohort watch-list (no AI). */
export function computeWatchList(result: SolveResult, students: Student[]): {
  level: 'high' | 'watch' | 'info'
  title: string
  detail: string
}[] {
  const items: { level: 'high' | 'watch' | 'info'; title: string; detail: string }[] = []
  const real = result.teams.filter((t) => !t.isHolding)

  // Teams without an OS anchor
  const noAnchor = real.filter((t) => !t.metrics.hasAnchor)
  if (noAnchor.length) {
    items.push({
      level: 'high',
      title: `${noAnchor.length} team(s) without an OS anchor`,
      detail: `Teams ${noAnchor.map((t) => t.index + 1).join(', ')} have no member rated 3+ on Linux or Windows/AD. Consider front-loading OS training or reallocating a strong anchor.`,
    })
  }

  // Scarce-skill coverage across teams
  for (const axis of SKILL_AXES) {
    const covering = real.filter((t) => t.metrics.coveredPillars.includes(axis.key)).length
    if (covering < real.length && covering <= Math.ceil(real.length / 2)) {
      items.push({
        level: covering <= 2 ? 'high' : 'watch',
        title: `${axis.label} reaches only ${covering} of ${real.length} teams`,
        detail: `Few students are confident in ${axis.label.toLowerCase()}. Those teams will rely on interest/learning rather than experience.`,
      })
    }
  }

  // Teams without >=2 shared days
  const badSchedule = real.filter((t) => t.metrics.sharedDays.length < 2)
  if (badSchedule.length) {
    items.push({
      level: 'watch',
      title: `${badSchedule.length} team(s) with fewer than 2 shared meeting days`,
      detail: `Teams ${badSchedule.map((t) => t.index + 1).join(', ')} may struggle to meet outside class.`,
    })
  }

  // Leftovers
  if (result.leftovers.length) {
    const names = result.leftovers.map((id) => {
      const s = students.find((s) => s.id === id)
      return s ? `${s.firstName} ${s.lastName}` : id
    })
    items.push({
      level: 'info',
      title: `${result.leftovers.length} student(s) not placed in a full team`,
      detail: `${names.join(', ')} form a holding team. When more responses arrive, re-run the whole allocation rather than bolting them on.`,
    })
  }

  return items
}

/**
 * Generate an AI rationale for one team. Falls back to the template on any AI
 * failure. Returns { text, usedAi }.
 */
export async function generateTeamRationale(
  team: TeamResult,
  students: Student[]
): Promise<{ text: string; usedAi: boolean }> {
  const members = team.memberIds.map((id) => students.find((s) => s.id === id)!).filter(Boolean)
  const gaps = team.metrics.gapPillars.map(axisLabel)
  const prompt = [
    `You are helping an instructor explain a student team placement for a cybersecurity/IT capstone.`,
    `Write 2-3 sentences, plain and specific, explaining why these students form a sound team.`,
    `Mention complementary strengths and the shared meeting days. If there is a coverage gap, name it honestly.`,
    `Do not invent facts. Members:`,
    ...members.map((m) => `- ${studentBlurb(m)}`),
    `Shared meeting days: ${team.metrics.sharedDays.join(', ') || 'none'}.`,
    gaps.length ? `Coverage gap: ${gaps.join(', ')}.` : `No major coverage gaps.`,
  ].join('\n')

  // One retry: reasoning models occasionally return an empty completion.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await chat(
        [
          { role: 'system', content: 'You write concise, factual team rationales. No preamble, no markdown headers. /no_think' },
          { role: 'user', content: prompt + '\n\n/no_think' },
        ],
        { temperature: 0.3, maxTokens: 320 }
      )
      const clean = stripThink(text).trim()
      if (clean) return { text: clean, usedAi: true }
    } catch {
      // fall through to next attempt / template
    }
  }
  return { text: templateRationale(team, students), usedAi: false }
}

/** Remove any <think>...</think> block some reasoning models emit. */
function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<\/?think>\s*/gi, '').trim()
}
