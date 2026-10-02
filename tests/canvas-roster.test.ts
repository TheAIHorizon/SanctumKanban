import test from 'node:test'
import assert from 'node:assert/strict'
import { canvasRosterColumns, convertCanvasRoster } from '../src/lib/canvas-roster'
import { parseRoster } from '../src/lib/student-roster'
const convert = (csv: string) => convertCanvasRoster(csv, canvasRosterColumns(csv).mapping)
test('Canvas Gradebook import drops grade columns and leading metadata, preserving compound names', () => {
  const csv = 'Student,ID,SIS User ID,SIS Login ID,Section,Private grade (123)\n,,,,,Manual Posting\nPoints Possible,,,,,100\n"de la Cruz, Ana María",11,001,ana@example.invalid,A,PRIVATE_GRADE'
  const r = convert(csv)
  assert.equal(r.skippedMetadata, 2); assert.equal(r.count, 1)
  assert.deepEqual(parseRoster(r.csv)[0], { row: 2, firstName: 'Ana María', lastName: 'de la Cruz', email: 'ana@example.invalid' })
  assert.ok(!r.csv.includes('PRIVATE_GRADE')); assert.ok(!r.csv.includes('001')); assert.ok(!r.csv.includes('Private grade'))
})
test('Canvas roster detects email and name columns, with explicit mapping for institution variations', () => {
  const csv = 'Student ID,Student Name,Email,Section\n11,Alex Example,alex@example.invalid,A'
  assert.equal(parseRoster(convert(csv).csv)[0].firstName, 'Alex')
  const custom = 'Given,Family,Campus Mail,Extra\nJamie,Example,jamie@example.invalid,ignored'
  const r = convertCanvasRoster(custom, { email: 2, firstName: 0, lastName: 1, fullName: -1, nameFormat: 'separate' })
  assert.equal(parseRoster(r.csv)[0].lastName, 'Example')
  const separate = 'LastName,FirstName,ID,SIS Login ID,Section,Grade\nPoints Possible,,,,,100\nExample,Alex,11,alex@example.invalid,A,90'
  assert.equal(convert(separate).skippedMetadata, 1)
})
test('Canvas conversion prefers actual Email and refuses to invent emails from usernames', () => {
  const csv = 'Student,SIS Login ID,Email\n"Example, Alex",alex01,real@example.invalid'
  assert.equal(parseRoster(convert(csv).csv)[0].email, 'real@example.invalid')
  assert.throws(() => convert('Student,SIS Login ID\n"Example, Alex",alex01'), /complete email/)
  assert.throws(() => convert('Student,Email\n"Student, Test",'), /complete email/)
})
test('Canvas conversion rejects ambiguous names, columns, duplicates and malformed rows', () => {
  assert.throws(() => convert('Student,Email\nAlex Example,alex@example.invalid'), /name format/)
  assert.throws(() => convert('Student Name,Email\n"Example, Alex",alex@example.invalid'), /Last, First/)
  assert.throws(() => convert('Student,Email\n"Example, Alex, Jr",alex@example.invalid'), /separate name/)
  assert.throws(() => convert('Student,Email\n"Example, Alex",alex@example.invalid\n"Example, Alex",alex@example.invalid'), /duplicate email/)
  assert.throws(() => convert('Student,Email\n"Example, Alex",alex@example.invalid,extra'), /cells/)
  assert.throws(() => convert('Student,Email\n"Example, Alex",alex@example.invalid\nPoints Possible,'), /complete email/)
  assert.throws(() => convertCanvasRoster('Student,Email\n"Example, Alex",alex@example.invalid', { fullName: 0, email: 0, firstName: -1, lastName: -1, nameFormat: 'last-first' }), /distinct/)
})
