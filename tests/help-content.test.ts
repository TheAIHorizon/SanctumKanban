import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HELP_GUIDES,
  getHelpGuideForRole,
  getHelpGuidesForRole,
  type HelpRole,
} from '../src/lib/help-content'

const nonAdminRoles: HelpRole[] = ['MEMBER', 'TEAM_LEAD', 'OBSERVER']
const publicSlugs = [
  'requests-and-bugs',
  'exports-and-assessments',
  'user-manual',
  'tickets',
  'gantt',
  'ai-guidance',
  'team-collaboration',
]
const adminSlugs = ['instructor-exams', 'instructor-tools', 'ga-checklist']

test('authenticated roles receive the shared guides', () => {
  for (const role of nonAdminRoles) {
    assert.deepEqual(getHelpGuidesForRole(role).map((guide) => guide.slug), publicSlugs)
  }
})

test('admins receive shared and admin-only guides', () => {
  assert.deepEqual(
    getHelpGuidesForRole('ADMIN').map((guide) => guide.slug).sort(),
    [...publicSlugs, ...adminSlugs].sort()
  )
})

test('guide lookup denies admin guides to every non-admin role', () => {
  for (const role of nonAdminRoles) {
    for (const slug of adminSlugs) {
      assert.equal(getHelpGuideForRole(slug, role), undefined)
    }
  }
  assert.equal(getHelpGuideForRole('instructor-tools', 'ADMIN')?.audience, 'admin')
})

test('guide lookup is a strict slug allowlist and rejects path-like input', () => {
  for (const slug of [
    'missing',
    '../user-manual',
    'user-manual.html',
    '/user-manual',
    'docs/user-manual',
    '%2e%2e%2fdocs%2fuser-manual.html',
    'USER-MANUAL',
  ]) {
    assert.equal(getHelpGuideForRole(slug, 'ADMIN'), undefined)
  }
})

test('catalogue is typed, complete, meaningful, and contains only renderable text blocks', () => {
  assert.equal(HELP_GUIDES.length, 10)
  assert.deepEqual(HELP_GUIDES.map((guide) => guide.slug).sort(), [...publicSlugs, ...adminSlugs].sort())

  for (const guide of HELP_GUIDES) {
    assert.ok(guide.title.length >= 4)
    assert.ok(guide.description.length >= 20)
    assert.ok(guide.sections.length >= 3, `${guide.slug} needs meaningful sections`)
    for (const section of guide.sections) {
      assert.ok(section.heading.length >= 3)
      assert.ok(section.blocks.length >= 1)
      for (const block of section.blocks) {
        assert.ok(block.type === 'paragraph' || block.type === 'bullets')
        if (block.type === 'paragraph') assert.ok(block.text.length >= 20)
        if (block.type === 'bullets') {
          assert.ok(block.items.length >= 2)
          assert.ok(block.items.every((item) => item.length >= 10))
        }
      }
    }
  }
})

test('curated catalogue excludes private paths, operational commands, credential markers, and raw HTML', () => {
  const source = JSON.stringify(HELP_GUIDES)
  const prohibited = [
    /\/Users\//i,
    /\/home\//i,
    /\/tmp\//i,
    /(?:^|[^a-z])DATABASE_URL/i,
    /AI_API_KEY/i,
    /password\s*[:=]/i,
    /docker\s+compose/i,
    /prisma\s+(?:migrate|db)/i,
    /npm\s+(?:run|install)/i,
    /<\/?[a-z][^>]*>/i,
    /dangerouslySetInnerHTML/i,
    /iframe/i,
  ]
  for (const marker of prohibited) assert.doesNotMatch(source, marker)
})

test('guides preserve the required behavior and safety distinctions', () => {
  const bySlug = Object.fromEntries(HELP_GUIDES.map((guide) => [guide.slug, JSON.stringify(guide)]))
  assert.match(bySlug['user-manual'], /Dashboard/)
  assert.match(bySlug['user-manual'], /Observer/)
  assert.match(bySlug.tickets, /Backlog/)
  assert.match(bySlug.gantt, /planned/i)
  assert.match(bySlug.gantt, /actual/i)
  assert.match(bySlug.gantt, /UTC/)
  assert.match(bySlug.gantt, /unknown/i)
  assert.match(bySlug['ai-guidance'], /Laguna S/)
  assert.match(bySlug['ai-guidance'], /manual/i)
  assert.match(bySlug['ai-guidance'], /nightly/i)
  assert.match(bySlug['ai-guidance'], /fallback/i)
  assert.match(bySlug['ai-guidance'], /not a grade|does not grade/i)
  assert.match(bySlug['team-collaboration'], /shared/i)
  assert.match(bySlug['team-collaboration'], /private/i)
  assert.match(bySlug['instructor-tools'], /ADMIN/)
  assert.match(bySlug['instructor-tools'], /student team lead/i)
  assert.match(bySlug['ga-checklist'], /disposable class/i)
  assert.match(bySlug['ga-checklist'], /never seed|never reset/i)
})
