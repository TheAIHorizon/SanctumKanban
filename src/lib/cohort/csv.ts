/**
 * Placement-survey CSV parsing + normalization.
 *
 * Maps the Google-Form CSV into normalized Student/SurveyResponse shape.
 * Column matching is by fuzzy header keyword so the form stays editable and
 * the ORIGINAL (pre-redesign) CSV still imports. Both the legacy multi-select
 * "confident areas" format and the new per-axis grid are handled.
 */

import { SKILL_AXES, WEEKDAYS } from './roles'
import type { Student } from './solver'

export interface ParsedRow {
  firstName: string
  lastName: string
  email: string
  skills: Record<string, number>
  depthNote?: string
  aspirationRole?: string | null
  leadership?: string | null
  availDays: string[]
  timePref?: string | null
  workStyle?: string | null
  partnerRequest?: string | null
  antiPartner?: string | null
  constraints?: string | null
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const lc = (s: string) => (s || '').toLowerCase()

/** Find the index of the first header containing all given keywords. */
function findCol(headers: string[], ...keywordSets: string[][]): number {
  for (const keywords of keywordSets) {
    const idx = headers.findIndex((h) => keywords.every((k) => lc(h).includes(k)))
    if (idx >= 0) return idx
  }
  return -1
}

function clampRating(v: string): number {
  const n = parseInt((v || '').trim(), 10)
  if (isNaN(n)) return 0
  return Math.max(0, Math.min(5, n))
}

// Legacy free-select "confident areas" -> axis keys.
const LEGACY_AREA_MAP: { match: string[]; axes: string[] }[] = [
  { match: ['network'], axes: ['network'] },
  { match: ['system administration'], axes: ['windowsAd'] },
  { match: ['active directory'], axes: ['windowsAd'] },
  { match: ['database'], axes: ['database'] },
  { match: ['web'], axes: ['web'] },
  { match: ['programming'], axes: ['programming'] },
  { match: ['automation'], axes: ['programming'] },
  { match: ['security'], axes: ['security'] },
  { match: ['vulnerability'], axes: ['security'] },
  { match: ['project management'], axes: [] }, // PM isn't a skill axis
]

function parseDays(raw: string): string[] {
  const l = lc(raw)
  return WEEKDAYS.filter((d) => l.includes(lc(d)))
}

function parseTimePref(raw: string): string | null {
  const l = lc(raw)
  if (l.includes('morning')) return 'morning'
  if (l.includes('afternoon')) return 'afternoon'
  if (l.includes('evening')) return 'evening'
  return 'none'
}

/**
 * Parse the CSV. `explicit` lets a caller override header→field mapping later
 * (for the review-UI column mapper); omitted = auto-detect.
 */
export function parseSurveyCsv(text: string): ParsedRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const headers = rows[0]

  const iFirst = findCol(headers, ['first', 'name'])
  const iLast = findCol(headers, ['last', 'name'])
  const iEmail = findCol(headers, ['email'], ['e-mail'])
  const iConfident = findCol(headers, ['confident'], ['technical areas'])
  const iLinux = findCol(headers, ['linux'], ['red hat'])
  const iWindows = findCol(headers, ['windows'], ['active directory'])
  const iInterest = findCol(headers, ['interested', 'mastering'], ['master'])
  const iAvail = findCol(headers, ['availability'], ['weekly availability'])
  const iTime = findCol(headers, ['time frame'], ['preferred time'])
  const iPartner = findCol(headers, ['grouped with'], ['anyone', 'grouped'])
  // New-format grid columns (optional): one per axis
  const gridCols: Record<string, number> = {}
  for (const axis of SKILL_AXES) {
    const idx = findCol(headers, [lc(axis.label).split(' ')[0]])
    if (idx >= 0) gridCols[axis.key] = idx
  }
  const iLeadership = findCol(headers, ['team lead'], ['leadership'])
  const iWorkStyle = findCol(headers, ['work', 'style'], ['contribute'])
  const iAnti = findCol(headers, ['not', 'paired'], ['prefer not'])
  const iConstraints = findCol(headers, ['constraint'], ['affecting your participation'])
  const iAspiration = findCol(headers, ['work role'], ['grow toward'])
  const iDepth = findCol(headers, ['built or done'], ['depth'])

  const out: ParsedRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')
    const firstName = get(iFirst)
    const lastName = get(iLast)
    const email = get(iEmail)
    if (!firstName && !lastName) continue

    // Skills: prefer explicit grid; else derive from legacy confident-areas + OS ratings.
    const skills: Record<string, number> = Object.fromEntries(SKILL_AXES.map((a) => [a.key, 0]))
    if (Object.keys(gridCols).length >= 4) {
      for (const [key, idx] of Object.entries(gridCols)) skills[key] = clampRating(get(idx))
    } else {
      // legacy: confident areas -> 3 (competent), OS self-ratings override linux/windows
      const conf = lc(get(iConfident))
      for (const { match, axes } of LEGACY_AREA_MAP) {
        if (match.some((m) => conf.includes(m))) for (const ax of axes) skills[ax] = Math.max(skills[ax], 3)
      }
      if (iLinux >= 0) skills.linux = clampRating(get(iLinux))
      if (iWindows >= 0) skills.windowsAd = clampRating(get(iWindows))
      // infer incident/security presence weakly from interest text
      const interest = lc(get(iInterest))
      if (interest.includes('security')) skills.security = Math.max(skills.security, 2)
    }

    out.push({
      firstName,
      lastName,
      email,
      skills,
      depthNote: get(iDepth) || undefined,
      aspirationRole: get(iAspiration) || null,
      leadership: iLeadership >= 0 ? mapLeadership(get(iLeadership)) : null,
      availDays: parseDays(get(iAvail)),
      timePref: parseTimePref(get(iTime)),
      workStyle: iWorkStyle >= 0 ? mapWorkStyle(get(iWorkStyle)) : null,
      partnerRequest: get(iPartner) || null,
      antiPartner: get(iAnti) || null,
      constraints: get(iConstraints) || null,
    })
  }
  return out
}

function mapLeadership(raw: string): string | null {
  const l = lc(raw)
  if (l.includes('prefer it') || l.includes('yes')) return 'prefer'
  if (l.includes('willing')) return 'willing'
  if (l.includes('not')) return 'no'
  return null
}
function mapWorkStyle(raw: string): string | null {
  const l = lc(raw)
  if (l.includes('deep')) return 'deep'
  if (l.includes('generalist')) return 'generalist'
  if (l.includes('doc') || l.includes('pm') || l.includes('coordinat')) return 'coordination'
  if (l.includes('flexible')) return 'flexible'
  return null
}

/** Convert parsed rows into solver Student objects (ids assigned by caller/order). */
export function toStudents(rows: ParsedRow[]): Student[] {
  return rows.map((r, i) => ({
    id: `s${i}`,
    firstName: r.firstName,
    lastName: r.lastName,
    skills: r.skills,
    aspirationRole: r.aspirationRole,
    leadership: (r.leadership as any) || null,
    availDays: r.availDays,
    timePref: r.timePref,
    workStyle: r.workStyle,
    partnerRequest: r.partnerRequest,
    antiPartner: r.antiPartner,
  }))
}
