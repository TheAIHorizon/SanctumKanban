import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canReadSavedGuidance, guidanceDraftLabel } from '../src/lib/saved-ticket-guidance'

test('saved guidance is private to admins and current team members', () => {
  assert.equal(canReadSavedGuidance('ADMIN', false), true)
  assert.equal(canReadSavedGuidance('MEMBER', true), true)
  assert.equal(canReadSavedGuidance('TEAM_LEAD', false), false)
  assert.equal(canReadSavedGuidance('OBSERVER', true), false)
})

test('non-current reviews are clearly labeled as old drafts', () => {
  assert.equal(guidanceDraftLabel(true), 'Current saved review')
  assert.equal(guidanceDraftLabel(false), 'Older draft review')
})

test('SavedTicketGuidance is explicitly loaded and protects against stale ticket responses', () => {
  const source = readFileSync('src/components/kanban/SavedTicketGuidance.tsx', 'utf8')
  assert.match(source, /Load saved guidance/)
  assert.match(source, /`\/api\/tickets\/\$\{ticketId\}\/guidance`/)
  assert.match(source, /new AbortController\(\)/)
  assert.match(source, /requestGeneration\.current/)
  assert.match(source, /finally/)
  assert.match(source, /AI-generated guidance/)
  assert.match(source, /Keyword fallback/)
  assert.match(source, /mode\.startsWith\('fallback'\)/)
  assert.match(source, /Nothing is applied automatically/)
  assert.doesNotMatch(source, /method: 'POST'/)
})

test('saved guidance is available in edit, expanded card, and authorized Gantt details', () => {
  const edit = readFileSync('src/components/kanban/EditTicketDialog.tsx', 'utf8')
  const card = readFileSync('src/components/kanban/TicketCard.tsx', 'utf8')
  const gantt = readFileSync('src/components/dashboard/GanttView.tsx', 'utf8')
  assert.match(edit, /<SavedTicketGuidance ticketId=\{ticket\.id\}/)
  assert.match(card, /showExpanded && canViewGuidance/)
  assert.match(card, /<SavedTicketGuidance ticketId=\{ticket\.id\}/)
  assert.match(gantt, /canReadSavedGuidance\(currentUser\.role/)
  assert.match(gantt, /<SavedTicketGuidance ticketId=\{ticket\.id\}/)
})
