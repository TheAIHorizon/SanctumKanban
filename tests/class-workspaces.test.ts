import test from 'node:test'
import assert from 'node:assert/strict'
import {
  legacyClassMemberIds,
  selectClassWorkspace,
  visibleClassWorkspaces,
  type ClassWorkspaceSummary,
} from '../src/lib/class-workspaces'

const classes: ClassWorkspaceSummary[] = [
  { id: 'fall', name: 'IST 4910 — Fall', archivedAt: null, memberUserIds: ['student-a'] },
  { id: 'spring', name: 'IST 4910 — Spring', archivedAt: null, memberUserIds: ['student-b'] },
  { id: 'old', name: 'IST 4910 — Archived', archivedAt: new Date('2026-05-01'), memberUserIds: ['student-a'] },
]

test('member sees active classes they belong to, not unrelated or archived classes', () => {
  const visible = visibleClassWorkspaces(classes, { id: 'student-a', role: 'MEMBER' }, false)
  assert.deepEqual(visible.map((c) => c.id), ['fall'])
})

test('admin and observer see every active class', () => {
  const admin = visibleClassWorkspaces(classes, { id: 'admin', role: 'ADMIN' }, false)
  const observer = visibleClassWorkspaces(classes, { id: 'observer', role: 'OBSERVER' }, false)
  assert.deepEqual(admin.map((c) => c.id), ['fall', 'spring'])
  assert.deepEqual(observer.map((c) => c.id), ['fall', 'spring'])
})

test('archived view contains only archived classes and remains scoped for members', () => {
  const member = visibleClassWorkspaces(classes, { id: 'student-a', role: 'MEMBER' }, true)
  const admin = visibleClassWorkspaces(classes, { id: 'admin', role: 'ADMIN' }, true)
  assert.deepEqual(member.map((c) => c.id), ['old'])
  assert.deepEqual(admin.map((c) => c.id), ['old'])
})

test('selection accepts a visible requested class and otherwise falls back to first visible', () => {
  const visible = visibleClassWorkspaces(classes, { id: 'admin', role: 'ADMIN' }, false)
  assert.equal(selectClassWorkspace(visible, 'spring')?.id, 'spring')
  assert.equal(selectClassWorkspace(visible, 'not-visible')?.id, 'fall')
})

test('selection returns null when no class is visible', () => {
  assert.equal(selectClassWorkspace([], 'fall'), null)
})

test('legacy backfill deduplicates team members into one class roster', () => {
  const ids = legacyClassMemberIds([
    { members: [{ userId: 'a' }, { userId: 'b' }] },
    { members: [{ userId: 'b' }, { userId: 'c' }] },
  ])
  assert.deepEqual(ids, ['a', 'b', 'c'])
})
