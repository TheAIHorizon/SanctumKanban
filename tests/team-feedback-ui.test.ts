import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canReadTeamFeedback, sortFeedbackChronologically } from '../src/lib/team-feedback'

test('private team feedback is visible only to admins and current team members', () => {
  assert.equal(canReadTeamFeedback('ADMIN', false), true)
  assert.equal(canReadTeamFeedback('MEMBER', true), true)
  assert.equal(canReadTeamFeedback('TEAM_LEAD', true), true)
  assert.equal(canReadTeamFeedback('TEAM_LEAD', false), false)
  assert.equal(canReadTeamFeedback('OBSERVER', true), false)
})

test('feedback posts and replies are ordered chronologically without mutating input', () => {
  const posts = [
    { id: 'new', createdAt: '2026-09-17T12:00:00Z', replies: [{ id: 'r2', createdAt: '2026-09-17T12:02:00Z' }, { id: 'r1', createdAt: '2026-09-17T12:01:00Z' }] },
    { id: 'old', createdAt: '2026-09-16T12:00:00Z', replies: [] },
  ]
  const sorted = sortFeedbackChronologically(posts)
  assert.deepEqual(sorted.map(post => post.id), ['old', 'new'])
  assert.deepEqual(sorted[1].replies.map(reply => reply.id), ['r1', 'r2'])
  assert.equal(posts[0].id, 'new')
})

test('TeamFeedback implements the feedback contract and stale-request protection', () => {
  const source = readFileSync('src/components/feedback/TeamFeedback.tsx', 'utf8')
  assert.match(source, /`\/api\/teams\/\$\{teamId\}\/feedback`/)
  assert.match(source, /`\/api\/teams\/\$\{teamId\}\/feedback\/\$\{feedbackId\}\/replies`/)
  assert.match(source, /`\/api\/teams\/\$\{teamId\}\/feedback\/\$\{feedbackId\}\/acknowledge`/)
  assert.match(source, /`\/api\/teams\/\$\{teamId\}\/feedback\/\$\{feedbackId\}`/)
  assert.match(source, /`\/api\/teams\/\$\{teamId\}\/feedback\/read`/)
  assert.match(source, /new AbortController\(\)/)
  assert.match(source, /requestGeneration\.current/)
  assert.match(source, /finally/)
  assert.doesNotMatch(source, /edit original/i)
})

test('TeamGrid preserves the true viewer role for archived private reads', () => {
  const grid = readFileSync('src/components/dashboard/TeamGrid.tsx', 'utf8')
  const kanban = readFileSync('src/components/kanban/TeamKanban.tsx', 'utf8')
  assert.match(grid, /viewerRole=\{currentUser\.role\}/)
  assert.match(grid, /currentUser=\{readOnly \? \{ \.\.\.currentUser, role: 'OBSERVER' \} : currentUser\}/)
  assert.match(kanban, /canReadTeamFeedback\(viewerRole/)
  assert.match(kanban, /<TeamFeedback/)
  assert.match(kanban, /Feedback/)
  assert.match(kanban, /unreadCount/)
})
