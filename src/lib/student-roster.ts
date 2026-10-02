import { z } from 'zod'
export type RosterRow = { row: number; firstName: string; lastName: string; email: string }
export type RosterPreviewRow = RosterRow & { action: 'CREATE' | 'ENROLL' | 'SKIP'; accountId: string | null; warning: string; boardAction: 'NONE' | 'CREATE' | 'KEEP' }
export type InitialCredential = { firstName: string; lastName: string; email: string; password: string }
export const ROSTER_TEMPLATE = 'First name,Last name,Email\r\nAlex,Example,alex@example.edu\r\nJamie,Example,jamie@example.edu\r\n'
const student = z.object({ firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100), email: z.string().email().max(254) })
/** Strict bounded CSV: reject malformed rows instead of silently shifting identities. */
export function readRosterCsv(text: string, maxLength = 100000): string[][] {
  if (text.length > maxLength) throw new Error('The roster file is too large.')
  text = text.replace(/^\uFEFF/, '')
  const records: string[][] = []; let row: string[] = [], field = '', state: 'plain' | 'quoted' | 'closed' = 'plain'
  const cell = () => { row.push(field); field = ''; state = 'plain' }
  const record = () => { cell(); if (row.some(v => v.trim())) records.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (state === 'quoted') {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else state = 'closed' }
      else field += ch
    } else if (ch === ',') cell()
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; record() }
    else if (ch === '"' && state === 'plain' && !field) state = 'quoted'
    else if (state === 'closed' || ch === '"') throw new Error(`Invalid CSV near record ${records.length + 1}. Check the quotation marks.`)
    else field += ch
  }
  if (state === 'quoted') throw new Error('Unclosed quotation mark in the CSV.')
  if (field || row.length || state === 'closed') record()
  return records
}
export function parseRoster(text: string): RosterRow[] {
  const records = readRosterCsv(text)
  if (records.length < 2) throw new Error('Include the header and at least one student.')
  if (records.length > 101) throw new Error('Import at most 100 students at a time. Split larger rosters into separate files.')
  const headers = records[0].map(h => h.trim().toLowerCase().replace(/[ _-]/g, ''))
  if (headers.length !== 3 || new Set(headers).size !== 3 || !['firstname', 'lastname', 'email'].every(h => headers.includes(h))) throw new Error('Use exactly these columns: First name, Last name, Email. Do not include roles or passwords.')
  const seen = new Set<string>()
  return records.slice(1).map((cells, i) => {
    if (cells.length !== 3) throw new Error(`Record ${i + 2}: expected three cells.`)
    const get = (key: string) => cells[headers.indexOf(key)].trim()
    const parsed = student.safeParse({ firstName: get('firstname'), lastName: get('lastname'), email: get('email').toLowerCase() })
    if (!parsed.success || Object.values(parsed.data).some(v => /[\u0000-\u001f\u007f]/.test(v))) throw new Error(`Record ${i + 2}: enter valid first name, last name and email. Names are limited to 100 characters.`)
    if (seen.has(parsed.data.email)) throw new Error(`Record ${i + 2}: duplicate email in this file. Keep one row per student.`)
    seen.add(parsed.data.email)
    return { row: i + 2, ...parsed.data }
  })
}
export function credentialCsv(rows: InitialCredential[]) {
  const cell = (value: string) => '"' + (/^[=+@\-\t\r\n]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'
  return '\uFEFF' + [['First name', 'Last name', 'Email', 'Initial password'], ...rows.map(r => [r.firstName, r.lastName, r.email, r.password])].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
