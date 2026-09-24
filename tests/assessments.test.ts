import test from 'node:test'
import assert from 'node:assert/strict'
import { validateQuestions, parseAssessmentJson, explanationWithAnswerText, sameQuestions, publicAssessment, canReadAssessment, scoreAnswers, type AssessmentQuestion } from '../src/lib/assessments'
const questions = Array.from({ length: 25 }, (_, i) => ({ stem: `Which action should be taken in scenario ${i}?`, options: ['Check configuration', 'Disable logging', 'Delete the results', 'Ignore the alert'], correctIndex: 0, explanation: 'Checking configuration establishes the current settings.', kind: i < 5 ? 'concept' : i < 15 ? 'application' : 'troubleshooting', sourceIds: ['ticket-1'] }))
test('requires 25 grounded, unique, balanced multiple-choice questions', () => {
  assert.equal(validateQuestions({ questions }, ['ticket-1']).length, 25)
  assert.throws(() => validateQuestions({ questions: questions.slice(1) }, ['ticket-1']))
  assert.throws(() => validateQuestions({ questions }, ['ticket-1'], [questions[0].stem]))
  assert.throws(() => validateQuestions({ questions }, ['another-student-ticket']))
  assert.throws(() => validateQuestions({ questions: questions.map(q => ({ ...q, stem: 'Same question repeated' })) }, ['ticket-1']))
  assert.throws(() => validateQuestions({ questions: questions.map(q => ({ ...q, correctIndex: 4 })) }, ['ticket-1']))
})
test('practice answers and explanations stay server-side until submission; exam drafts stay staff-only', () => {
  const attempt = { id: 'a', studentId: 's', mode: 'PRACTICE', status: 'READY', questions, submittedAt: null, sources: [{ private: true }], leaseToken: 'private' }
  const student = publicAssessment(attempt, false)
  assert.ok(!JSON.stringify(student).includes('correctIndex'))
  assert.ok(!JSON.stringify(student).includes('explanation'))
  assert.ok(!JSON.stringify(student).includes('private'))
  assert.equal(canReadAssessment({ id: 's', role: 'MEMBER' }, attempt), true)
  assert.equal(canReadAssessment({ id: 'other', role: 'TEAM_LEAD' }, attempt), false)
  assert.equal(canReadAssessment({ id: 's', role: 'OBSERVER' }, attempt), false)
  assert.equal(canReadAssessment({ id: 's', role: 'TEAM_LEAD' }, { ...attempt, mode: 'EXAM' }), false)
  assert.ok(JSON.stringify(publicAssessment({ ...attempt, submittedAt: new Date() }, false)).includes('correctIndex'))
})
test('grading rejects incomplete/out-of-range submissions', () => {
  assert.equal(scoreAnswers(questions as any, Array(25).fill(0)), 25)
  assert.throws(() => scoreAnswers(questions as any, Array(24).fill(0)))
  assert.throws(() => scoreAnswers(questions as any, Array(25).fill(5)))
})


test('accepting defaults ignores JSONB key order but records actual question edits', () => {
  const reordered = questions.map(q => Object.fromEntries(Object.entries(q).reverse()))
  assert.equal(sameQuestions(questions, reordered), true)
  assert.equal(sameQuestions(questions, questions.map((q, i) => i ? q : { ...q, explanation: 'A revised instructor explanation with different reasoning.' })), false)
})


test('model JSON parsing tolerates wrappers but never repairs incomplete questions', () => {
  assert.deepEqual(parseAssessmentJson('```json\n{"text":"a } bracket", "nested":{"ok":true}}\n```"}'), { text: 'a } bracket', nested: { ok: true } })
  assert.throws(() => parseAssessmentJson('{"questions":[{"stem":"unfinished"}'))
  assert.throws(() => parseAssessmentJson('{invalid}'))
})
test('explanations keep original answer text when choices are shuffled', () => {
  const q = { ...questions[0], explanation: 'Choice 0 collects evidence; option B removes it.' } as AssessmentQuestion
  const result = explanationWithAnswerText(q)
  assert.ok(result.includes(q.options[0])); assert.ok(result.includes(q.options[1]))
  assert.equal(explanationWithAnswerText({ ...q, explanation: 'Use the log to answer a question.' }), 'Use the log to answer a question.')
})
