import { parseRoster, readRosterCsv } from './student-roster'
export type CanvasRosterMapping = { email: number; firstName: number; lastName: number; fullName: number; nameFormat: 'separate' | 'last-first' | 'first-last' }
export const normalizeRosterHeader = (value: string) => value.trim().toLowerCase().replace(/[ _-]/g, '')
export function canvasRosterColumns(csv: string) {
  const headers = readRosterCsv(csv, 1000000)[0] || []
  if (!headers.length) throw new Error('The CSV has no header.')
  const keys = headers.map(normalizeRosterHeader)
  const find = (...names: string[]) => { for (const name of names) { const i = keys.indexOf(name); if (i >= 0) return i } return -1 }
  const firstName = find('firstname', 'studentfirstname'), lastName = find('lastname', 'studentlastname')
  const fullName = find('sortablename', 'student', 'studentname', 'fullname', 'name')
  const email = find('email', 'emailaddress', 'studentemail', 'studentemailaddress', 'sisloginid', 'loginid')
  return { headers, mapping: { email, firstName, lastName, fullName, nameFormat: firstName >= 0 && lastName >= 0 ? 'separate' : fullName >= 0 && ['sortablename', 'student'].includes(keys[fullName]) ? 'last-first' : 'first-last' } as CanvasRosterMapping }
}
/** Runs in the browser: only these three identity fields leave the file. */
export function convertCanvasRoster(csv: string, mapping: CanvasRosterMapping) {
  const records = readRosterCsv(csv, 1000000)
  if (records.length < 2) throw new Error('Include the header and at least one student.')
  const headers = records[0], keys = headers.map(normalizeRosterHeader)
  const selected = mapping.nameFormat === 'separate' ? [mapping.firstName, mapping.lastName, mapping.email] : [mapping.fullName, mapping.email]
  if (selected.some(i => !Number.isInteger(i) || i < 0 || i >= headers.length) || new Set(selected).size !== selected.length) throw new Error('Choose distinct name and email columns before previewing.')
  // Skip only the recognizable leading Gradebook metadata, never arbitrary
  // missing-email student rows or rows identified only by a person's name.
  const gradebook = keys.includes('id') && keys.includes('sisloginid') && keys.includes('section') && (keys.includes('student') || keys.includes('lastname') && keys.includes('firstname'))
  const identityColumns = ['id', 'sisuserid', 'sisloginid', 'email', 'emailaddress', 'studentemail', 'loginid', 'integrationid'].map(k => keys.indexOf(k)).filter(i => i >= 0)
  const firstColumn = keys.includes('student') ? keys.indexOf('student') : keys.indexOf('lastname')
  let skippedMetadata = 0, startedStudents = false
  const students: string[][] = []
  for (let i = 1; i < records.length; i++) {
    const row = records[i]
    if (row.length !== headers.length) throw new Error(`Canvas record ${i + 1}: the number of cells does not match the header.`)
    const get = (index: number) => (row[index] || '').trim()
    const label = get(firstColumn).toLowerCase()
    if (gradebook && !startedStudents && identityColumns.every(index => !get(index)) && selected.filter(index => index !== firstColumn).every(index => !get(index)) && (label === '' || label === 'points possible')) { skippedMetadata++; continue }
    startedStudents = true
    const email = get(mapping.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Canvas record ${i + 1}: the selected column does not contain a complete email address. Choose Email or add verified email addresses; usernames and SIS numbers cannot be used. Remove any Canvas Test Student row without an email.`)
    let firstName = get(mapping.firstName), lastName = get(mapping.lastName)
    if (mapping.nameFormat !== 'separate') {
      const name = get(mapping.fullName)
      if (mapping.nameFormat === 'last-first') {
        const split = name.indexOf(',')
        if (split < 1 || name.indexOf(',', split + 1) >= 0) throw new Error(`Canvas record ${i + 1}: expected Last, First. Choose the matching name format or provide separate name columns.`)
        lastName = name.slice(0, split).trim(); firstName = name.slice(split + 1).trim()
      } else {
        if (name.includes(',')) throw new Error(`Canvas record ${i + 1}: choose Last, First for comma-separated names.`)
        const split = name.search(/\s/)
        if (split < 1) throw new Error(`Canvas record ${i + 1}: use separate first and last name columns for this name.`)
        firstName = name.slice(0, split).trim(); lastName = name.slice(split + 1).trim()
      }
    }
    students.push([firstName, lastName, email])
  }
  const cell = (v: string) => '"' + v.replace(/"/g, '""') + '"'
  const normalizedCsv = [['First name', 'Last name', 'Email'], ...students].map(row => row.map(cell).join(',')).join('\r\n')
  // Preserve the existing count, identity, duplicate and length validation.
  parseRoster(normalizedCsv)
  return { csv: normalizedCsv, skippedMetadata, count: students.length }
}
