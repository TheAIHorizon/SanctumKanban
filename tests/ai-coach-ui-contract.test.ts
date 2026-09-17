import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const coachSource = () => readFileSync('src/components/kanban/TicketAiCoach.tsx', 'utf8')
const editSource = () => readFileSync('src/components/kanban/EditTicketDialog.tsx', 'utf8')
const pickerSource = () => readFileSync('src/components/dcwf/DcwfTaskPicker.tsx', 'utf8')

test('AI Coach is an explicit editable-ticket tab using the current draft', () => {
  const edit = editSource()

  assert.match(edit, /TabsTrigger value="coach">AI Coach<\/TabsTrigger>/)
  assert.match(edit, /<TicketAiCoach[\s\S]*ticketId=\{ticket\.id\}[\s\S]*title=\{title\}[\s\S]*description=\{description\}/)
  assert.match(edit, /onOpenDcwf=\{\(\) => setActiveTab\('dcwf'\)\}/)
})

test('AI Coach only sends draft text after a user action and guards stale requests', () => {
  const source = coachSource()

  assert.match(source, /onClick=\{requestCoaching\}/)
  assert.match(source, /body: JSON\.stringify\(\{ ticketId, text, inScopeOnly: true \}\)/)
  assert.match(source, /new AbortController\(\)/)
  assert.match(source, /requestGeneration\.current/)
  assert.match(source, /\[ticketId, title, description\]/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test('AI Coach explains privacy, advisory limits, fallback mode, and bounded evidence', () => {
  const source = coachSource()

  assert.match(source, /user-owned CoyoteGPT/i)
  assert.match(source, /advisory, not a grade/i)
  assert.match(source, /Missing evidence does not mean the work was not done/i)
  assert.match(source, /mode === 'ai'/)
  assert.match(source, /Keyword fallback/i)
  assert.match(source, /feedback\.slice\(0, MAX_FEEDBACK\)/)
  assert.match(source, /tasks\.slice\(0, MAX_TASKS\)/)
  assert.match(source, /source\.ksatId/)
  assert.match(source, /source\.description/)
})

test('AI Coach reports rate limits and request failures without a perpetual spinner', () => {
  const source = coachSource()

  assert.match(source, /response\.status === 429/)
  assert.match(source, /setLoading\(false\)/)
  assert.match(source, /Try again/)
  assert.match(source, /disabled=\{loading/)
})

test('DCWF picker includes ticket context and accurately labels fallback and errors', () => {
  const source = pickerSource()

  assert.match(source, /JSON\.stringify\(\{ ticketId, text: suggestText, inScopeOnly \}\)/)
  assert.match(source, /res\.status === 429/)
  assert.match(source, /data\.mode === 'fallback'/)
  assert.match(source, /Keyword fallback — no validated AI selection was available/)
  assert.doesNotMatch(source, /CoyoteGPT was unavailable/)
  assert.match(source, /aria-label="Remove DCWF task link"/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})
