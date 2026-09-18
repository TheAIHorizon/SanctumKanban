import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('feedback ticket references open the permission-aware ticket dialog', () => {
  assert.match(readFileSync('src/components/feedback/TeamFeedback.tsx', 'utf8'), /onOpenTicket\?\.\(post\.ticket!\.id\)/)
  assert.match(readFileSync('src/components/kanban/TeamKanban.tsx', 'utf8'), /onOpenTicket=\{setFeedbackTicketId\}/)
  assert.doesNotMatch(readFileSync('src/components/feedback/TeamFeedback.tsx', 'utf8'), /onUnreadCountChange\?\.\(0\)/)
})
