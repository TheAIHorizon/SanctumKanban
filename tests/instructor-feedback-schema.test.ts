import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema = readFileSync('prisma/schema.prisma', 'utf8')

test('schema defines instructor feedback category and private team feedback records', () => {
  assert.match(schema, /enum InstructorFeedbackCategory[\s\S]*GUIDANCE[\s\S]*NEEDS_ATTENTION[\s\S]*ACTION_REQUIRED/)
  for (const model of ['InstructorFeedback', 'InstructorFeedbackReply', 'InstructorFeedbackAcknowledgment', 'TeamFeedbackRead']) {
    assert.match(schema, new RegExp(`model ${model} \\{`))
  }
  assert.match(schema, /model InstructorFeedback[\s\S]*authorId\s+String\?[\s\S]*authorName\s+String[\s\S]*pinned\s+Boolean\s+@default\(false\)/)
  assert.match(schema, /model InstructorFeedback[\s\S]*author\s+User\?[\s\S]*onDelete: SetNull/)
  assert.match(schema, /model InstructorFeedbackAcknowledgment[\s\S]*@@unique\(\[feedbackId, userId\]\)/)
  assert.match(schema, /model TeamFeedbackRead[\s\S]*readThrough\s+DateTime[\s\S]*@@unique\(\[teamId, userId\]\)/)
})

test('schema includes nightly review configuration and AI guidance contract', () => {
  const workspace = schema.slice(schema.indexOf('model ClassWorkspace'), schema.indexOf('model ClassWorkspaceMember'))
  assert.match(workspace, /nightlyReviewEnabled\s+Boolean\s+@default\(false\)/)
  assert.match(workspace, /nightlyReviewHour\s+Int\s+@default\(2\)/)
  assert.match(workspace, /nightlyReviewTimezone\s+String\s+@default\("America\/Los_Angeles"\)/)
  assert.match(workspace, /nightlyReviewRequestedAt\s+DateTime\?/)
  assert.match(workspace, /nightlyReviewLastRunAt\s+DateTime\?/)
  assert.match(workspace, /nightlyReviewLastRunDate\s+String\?/)
  assert.match(workspace, /nightlyReviewLastError\s+String\?/)
  assert.match(workspace, /nightlyReviewLastSummary\s+Json\?/)
  assert.match(schema, /model TicketAiGuidance[\s\S]*@@unique\(\[ticketId, inputHash\]\)/)
  assert.match(schema, /model NightlyReviewLease[\s\S]*id\s+String\s+@id[\s\S]*owner\s+String[\s\S]*expiresAt\s+DateTime/)
})

test('one additive migration contains feedback and nightly review schema', () => {
  const migration = readFileSync('prisma/migrations/20260917_add_instructor_feedback_and_nightly_review/migration.sql', 'utf8')
  assert.match(migration, /CREATE TYPE "InstructorFeedbackCategory"/)
  assert.match(migration, /CREATE TABLE "InstructorFeedback"/)
  assert.match(migration, /CREATE TABLE "TicketAiGuidance"/)
  assert.match(migration, /CREATE TABLE "NightlyReviewLease"/)
  assert.doesNotMatch(migration, /INSERT INTO/)
})
