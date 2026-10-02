import test from 'node:test'
import assert from 'node:assert/strict'
import { libraryWhere, libraryQuerySchema, assessmentSummarySelect } from '../src/lib/assessment-library.server'
import { assessmentScope } from '../src/lib/assessment-data.server'
const db = { classWorkspace: { findFirst: async () => ({ id: 'course' }) } } as any
test('library queries fence student access and allow staff to browse a class or student across classes', async () => {
  const member = { id: 'student', role: 'TEAM_LEAD' }, staff = { id: 'staff', role: 'ADMIN' }
  const query = libraryQuerySchema.parse({ classId: 'course' })
  assert.deepEqual(await libraryWhere(db, member, query), { classWorkspaceId: 'course', studentId: 'student', mode: 'PRACTICE' })
  assert.deepEqual(await libraryWhere(db, staff, query), { classWorkspaceId: 'course' })
  assert.deepEqual(await libraryWhere(db, staff, { ...query, classId: 'all', studentId: 'student' }), { studentId: 'student' })
  await assert.rejects(libraryWhere(db, member, { ...query, studentId: 'someone-else' }))
  await assert.rejects(libraryWhere(db, member, { ...query, classId: 'all' }))
  await assert.rejects(libraryWhere(db, member, { ...query, mode: 'EXAM' }))
  await assert.rejects(libraryWhere(db, { id: 'observer', role: 'OBSERVER' }, query))
  for (const secret of ['questions', 'answers', 'sources', 'references', 'leaseToken']) assert.ok(!(secret in assessmentSummarySelect))
})
test('staff can read former enrollment history without granting new write access', async () => {
  const mock = { classWorkspace: { findUnique: async () => ({ id: 'course', members: [], archivedAt: null }) }, assessment: { findFirst: async () => ({ id: 'saved' }) }, $queryRaw: async () => [] } as any
  assert.ok(await assessmentScope(mock, { id: 'staff', role: 'ADMIN' }, 'course', 'former'))
  await assert.rejects(assessmentScope(mock, { id: 'staff', role: 'ADMIN' }, 'course', 'former', true))
  await assert.rejects(assessmentScope(mock, { id: 'former', role: 'MEMBER' }, 'course', 'former'))
  mock.assessment.findFirst = async () => null
  await assert.rejects(assessmentScope(mock, { id: 'staff', role: 'ADMIN' }, 'course', 'stranger'))
})
