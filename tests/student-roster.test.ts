import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRoster, credentialCsv } from '../src/lib/student-roster'

test('roster handles BOM, Excel headers, quoted commas and Unicode, and normalizes emails', () => {
  assert.deepEqual(parseRoster('\uFEFFFirst Name,Last Name,Email\r\n"Ana, María",O’Neil, ANA@example.invalid \r\n'), [{ row: 2, firstName: 'Ana, María', lastName: 'O’Neil', email: 'ana@example.invalid' }])
  assert.equal(parseRoster('firstName,lastName,email\nAda,Example,ada@example.invalid')[0].firstName, 'Ada')
})
test('roster rejects malformed, duplicate, ambiguous and unsupported input without dropping rows', () => {
  for (const csv of ['firstName,lastName,email\n"Ada,X,a@example.invalid', 'firstName,lastName,email\nAd"a,X,a@example.invalid', 'firstName,lastName,email\n"Ada"x,X,a@example.invalid', 'firstName,lastName,email\nAda,X,a@example.invalid,extra', 'firstName,lastName,email\nAda,,a@example.invalid', 'firstName,lastName,email\nAda,X,not-email', 'firstName,lastName,email,role\nAda,X,a@example.invalid,ADMIN', 'firstName,lastName,email,email\nAda,X,a@example.invalid,a@example.invalid', 'firstName,lastName,email\nAda,X,a@example.invalid\nOther,X,A@example.invalid', 'firstName,lastName,email\n']) assert.throws(() => parseRoster(csv))
  assert.throws(() => parseRoster('firstName,lastName,email\n' + Array.from({ length: 101 }, (_, i) => `Student,Example,s${i}@example.invalid`).join('\n')), /100/)
})
test('credential CSV neutralizes spreadsheet formulas and quotes cells', () => {
  const csv = credentialCsv([{ firstName: '=1+1', lastName: 'A,"B"', email: '+a@example.invalid', password: 'SK-unique-initial-password' }])
  assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('"A,""B"""')); assert.ok(csv.includes('"\'+a@example.invalid"'))
})
