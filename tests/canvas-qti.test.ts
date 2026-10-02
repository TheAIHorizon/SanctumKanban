import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { buildCanvasExport, canvasQtiFiles, xml, type CanvasAssessment } from '../src/lib/canvas-qti'
const fixture = (id = 'test-one'): CanvasAssessment => ({
  id, mode: 'EXAM', status: 'APPROVED', from: '2026-09-01', to: '2026-10-01', createdAt: new Date('2026-10-01'),
  student: { firstName: '<Demo>', lastName: 'A & B' }, classWorkspace: { name: 'Synthetic Course' },
  sources: [{ id: 'source', description: 'PRIVATE_EVIDENCE_SENTINEL' }],
  questions: Array.from({ length: 25 }, (_, i) => ({ stem: `Scenario ${i}: compare x < y & "z". <script>alert(1)</script>`, options: ['Choice <one>', 'Choice & two', 'Choice "three"', 'Fourth choice'], correctIndex: i % 4, explanation: 'The selected choice explains the fictional observation.', kind: i < 5 ? 'concept' : i < 15 ? 'application' : 'troubleshooting', sourceIds: ['source'] })),
})
test('QTI preserves every answer after shuffling and exports quiz content without source evidence', () => {
  const a = fixture(), files = canvasQtiFiles([a], 4)
  const assessment = strFromU8(Object.entries(files).find(([name]) => name.endsWith('/assessment.xml'))![1])
  assert.equal((assessment.match(/<item ident=/g) || []).length, 25)
  const keys = Array.from(assessment.matchAll(/<varequal respident="response1">choice_(\d)<\/varequal>/g), m => Number(m[1]))
  assert.deepEqual(keys, Array.from({ length: 25 }, (_, i) => i % 4))
  assert.equal((assessment.match(/<fieldentry>4<\/fieldentry>/g) || []).length, 25)
  assert.ok(assessment.includes('&amp;lt;script&amp;gt;'))
  assert.ok(!assessment.includes('<script>'))
  assert.ok(!assessment.includes('PRIVATE_EVIDENCE_SENTINEL'))
  assert.ok(!assessment.includes('sourceIds'))
  assert.match(strFromU8(files['imsmanifest.xml']), /imsqti_xmlv1p2/)
})
test('class packages keep assessments separate and New Quizzes bundles contain importable individual ZIPs', () => {
  const a = fixture(), b = fixture('test-two')
  const combined = unzipSync(buildCanvasExport([a, b], 'qti'))
  const manifest = strFromU8(combined['imsmanifest.xml'])
  assert.equal((manifest.match(/<resource identifier=/g) || []).length, 2)
  for (const [, href] of manifest.matchAll(/<file href="([^"]+)"/g)) assert.ok(combined[href])
  const bundle = unzipSync(buildCanvasExport([a, b], 'individual'))
  assert.ok(!bundle['imsmanifest.xml'])
  const zipNames = Object.keys(bundle).filter(name => name.endsWith('.zip'))
  assert.equal(zipNames.length, 2)
  for (const name of zipNames) {
    const files = unzipSync(bundle[name])
    assert.ok(files['imsmanifest.xml'])
    assert.equal(Object.keys(files).filter(path => path.endsWith('/assessment.xml')).length, 1)
  }
  assert.ok(bundle['IMPORT-INSTRUCTIONS.txt']); assert.equal(JSON.parse(strFromU8(bundle['quiz-index.json'])).length, 2)
  assert.deepEqual(Object.keys(canvasQtiFiles([a])), Object.keys(canvasQtiFiles([a])))
})
test('unapproved, failed, invalid or cross-evidence questions cannot silently enter a package', () => {
  assert.throws(() => buildCanvasExport([{ ...fixture(), status: 'READY' }], 'qti'))
  assert.throws(() => buildCanvasExport([{ ...fixture(), status: 'FAILED' }], 'qti'))
  assert.throws(() => buildCanvasExport([{ ...fixture(), sources: [] }], 'qti'))
  assert.throws(() => buildCanvasExport([{ ...fixture(), questions: [] }], 'qti'))
  assert.throws(() => buildCanvasExport([fixture(), fixture()], 'qti'))
  assert.throws(() => buildCanvasExport([], 'qti'))
  assert.throws(() => buildCanvasExport([fixture()], 'qti', 0))
  assert.throws(() => buildCanvasExport([fixture()], 'qti', 1.5))
  assert.ok(buildCanvasExport([{ ...fixture(), mode: 'PRACTICE', status: 'READY' }], 'qti').length)
})
test('XML sanitization removes forbidden codepoints without losing Unicode text', () => {
  assert.equal(xml('café 😀\u0000\u0001\uD800<&'), 'café 😀&lt;&amp;')
})
