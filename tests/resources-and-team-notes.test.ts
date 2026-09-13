import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MAX_RESOURCE_URL_LENGTH,
  RESOURCE_DEFINITIONS,
  canReadClassResources,
  canWriteClassResources,
  normalizeResourceEntries,
  resourceEntriesEqual,
  validateResourceUrl,
} from '../src/lib/student-resources'
import {
  MAX_TEAM_NOTE_LENGTH,
  canReadTeamNote,
  canWriteTeamNote,
  parseExpectedRevision,
  validateTeamNoteContent,
} from '../src/lib/team-notes'

test('student resources expose the seven required labels in dashboard order', () => {
  assert.deepEqual(
    RESOURCE_DEFINITIONS.map(({ key, label }) => ({ key, label })),
    [
      { key: 'NETWORK_MAP', label: 'Network map' },
      { key: 'RED_HAT', label: 'Red Hat' },
      { key: 'PROJECT_TUTORIAL', label: 'Project tutorial' },
      { key: 'VISIO_TUTORIAL', label: 'Visio tutorial' },
      { key: 'REQUIREMENTS_LIST', label: 'Requirements list' },
      { key: 'LAB_LINK', label: 'Lab link' },
      { key: 'EXTRAS', label: 'Extras' },
    ]
  )
})

test('resource URLs accept only absolute http and https URLs', () => {
  assert.equal(validateResourceUrl('https://intranet.example.edu/map'), true)
  assert.equal(validateResourceUrl('http://localhost:8080/lab'), true)
  assert.equal(validateResourceUrl('javascript:alert(1)'), false)
  assert.equal(validateResourceUrl('data:text/html,bad'), false)
  assert.equal(validateResourceUrl('/relative'), false)
  assert.equal(validateResourceUrl('not a url'), false)
  assert.equal(validateResourceUrl('https://user:password@example.test/private'), false)
  assert.equal(validateResourceUrl(`https://example.test/${'x'.repeat(MAX_RESOURCE_URL_LENGTH)}`), false)
})

test('resource normalization trims values, omits blanks, and rejects unknown or duplicate keys', () => {
  assert.deepEqual(normalizeResourceEntries([
    { key: 'RED_HAT', url: ' https://access.redhat.com/ ' },
    { key: 'LAB_LINK', url: '  ' },
  ]), [{ key: 'RED_HAT', url: 'https://access.redhat.com/' }])
  assert.throws(() => normalizeResourceEntries([{ key: 'OTHER', url: 'https://example.test' }]), /Unknown resource/)
  assert.throws(() => normalizeResourceEntries([
    { key: 'RED_HAT', url: 'https://one.test' },
    { key: 'RED_HAT', url: 'https://two.test' },
  ]), /Duplicate resource/)
  assert.throws(() => normalizeResourceEntries([{ key: 'RED_HAT', url: 'javascript:alert(1)' }]), /http or https/)
  assert.throws(() => normalizeResourceEntries(Array(8).fill({ key: 'RED_HAT', url: '' })), /at most 7/)
})

test('class resources are class-scoped for reads and admin-only for active writes', () => {
  const members = ['member-a']
  assert.equal(canReadClassResources({ id: 'admin', role: 'ADMIN' }, members), true)
  assert.equal(canReadClassResources({ id: 'observer', role: 'OBSERVER' }, members), true)
  assert.equal(canReadClassResources({ id: 'member-a', role: 'MEMBER' }, members), true)
  assert.equal(canReadClassResources({ id: 'outsider', role: 'MEMBER' }, members), false)
  assert.equal(canWriteClassResources({ id: 'admin', role: 'ADMIN' }, false), true)
  assert.equal(canWriteClassResources({ id: 'admin', role: 'ADMIN' }, true), false)
  assert.equal(canWriteClassResources({ id: 'member-a', role: 'MEMBER' }, false), false)
})

test('resource baselines compare normalized whole-array state independent of row order', () => {
  assert.equal(resourceEntriesEqual(
    [
      { key: 'LAB_LINK', url: 'https://lab.example.test' },
      { key: 'RED_HAT', url: 'https://redhat.example.test' },
    ],
    [
      { key: 'RED_HAT', url: 'https://redhat.example.test' },
      { key: 'LAB_LINK', url: 'https://lab.example.test' },
    ]
  ), true)
  assert.equal(resourceEntriesEqual(
    [{ key: 'LAB_LINK', url: 'https://old.example.test' }],
    [{ key: 'LAB_LINK', url: 'https://new.example.test' }]
  ), false)
})

test('resource PUT locks the class and rejects a stale expectedResources baseline before replacing rows', () => {
  const source = readFileSync('src/app/api/classes/[id]/resources/route.ts', 'utf8')

  assert.match(source, /body\.expectedResources/)
  assert.match(source, /FOR UPDATE/)
  assert.match(source, /resourceEntriesEqual\(currentResources, expectedResources\)/)
  assert.match(source, /Class resources changed; reload before saving/)
})

test('resource editor blocks stale saves until the user explicitly reloads the latest resources', () => {
  const source = readFileSync('src/components/resources/ClassResourceEditor.tsx', 'utf8')

  assert.match(source, /expectedResources: baselineResources/)
  assert.match(source, /response\.status === 409/)
  assert.match(source, /setConflicted\(true\)/)
  assert.match(source, /disabled=\{saving \|\| conflicted\}/)
  assert.match(source, /Reload latest/)
  assert.match(source, /Copy your draft before reloading/)
  assert.doesNotMatch(source, /reloadBaselinePreservingDraft/)

  const conflictBranch = source.slice(
    source.indexOf('if (response.status === 409)'),
    source.indexOf('if (!response.ok)')
  )
  assert.doesNotMatch(conflictBranch, /setBaselineResources|fetchResources/)
  assert.match(source, /const reloadLatest[\s\S]*setValues\(valuesFromResources\(currentResources\)\)[\s\S]*setBaselineResources\(currentResources\)[\s\S]*setConflicted\(false\)/)
})

test('team notes follow class visibility for reads', () => {
  assert.equal(canReadTeamNote({ id: 'admin', role: 'ADMIN' }, { classMemberUserIds: [], hasClass: true }), true)
  assert.equal(canReadTeamNote({ id: 'observer', role: 'OBSERVER' }, { classMemberUserIds: [], hasClass: true }), true)
  assert.equal(canReadTeamNote({ id: 'member-a', role: 'MEMBER' }, { classMemberUserIds: ['member-a'], hasClass: true }), true)
  assert.equal(canReadTeamNote({ id: 'outsider', role: 'MEMBER' }, { classMemberUserIds: ['member-a'], hasClass: true }), false)
  assert.equal(canReadTeamNote({ id: 'member-a', role: 'MEMBER' }, { classMemberUserIds: [], hasClass: false, teamMemberUserIds: ['member-a'] }), true)
})

test('only own team members and admins can write active team notes', () => {
  const active = { teamMemberUserIds: ['member-a'], archived: false }
  assert.equal(canWriteTeamNote({ id: 'admin', role: 'ADMIN' }, active), true)
  assert.equal(canWriteTeamNote({ id: 'member-a', role: 'MEMBER' }, active), true)
  assert.equal(canWriteTeamNote({ id: 'observer', role: 'OBSERVER' }, active), false)
  assert.equal(canWriteTeamNote({ id: 'other-team', role: 'MEMBER' }, active), false)
  assert.equal(canWriteTeamNote({ id: 'admin', role: 'ADMIN' }, { ...active, archived: true }), false)
  assert.equal(canWriteTeamNote({ id: 'member-a', role: 'MEMBER' }, { ...active, archived: true }), false)
})

test('team note content is trimmed and length-limited', () => {
  assert.equal(validateTeamNoteContent('  shared update  '), 'shared update')
  assert.equal(validateTeamNoteContent(''), '')
  assert.throws(() => validateTeamNoteContent('x'.repeat(MAX_TEAM_NOTE_LENGTH + 1)), /at most/)
  assert.throws(() => validateTeamNoteContent(null), /string/)
})

test('team note writes require a non-negative integer revision for conflict protection', () => {
  assert.equal(parseExpectedRevision(0), 0)
  assert.equal(parseExpectedRevision(12), 12)
  assert.throws(() => parseExpectedRevision(undefined), /revision/)
  assert.throws(() => parseExpectedRevision(-1), /revision/)
  assert.throws(() => parseExpectedRevision(1.5), /revision/)
})

test('team note authorization, CAS update, and read-back stay in one locked transaction', () => {
  const source = readFileSync('src/app/api/teams/[id]/note/route.ts', 'utf8')

  assert.match(source, /prisma\.\$transaction\(\s*async \(tx\)/)
  assert.match(source, /FOR UPDATE/)
  const transactionStart = source.indexOf('prisma.$transaction')
  assert.ok(source.indexOf('teamNote.updateMany', transactionStart) > transactionStart)
  assert.ok(source.indexOf('teamNote.findUnique', transactionStart) > transactionStart)
})
