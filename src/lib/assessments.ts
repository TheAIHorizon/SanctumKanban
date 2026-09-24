import { z } from 'zod'
export const ASSESSMENT_PROMPT_VERSION = 'personal-assessment-v1'
export const QuestionSchema = z.object({
  stem: z.string().trim().min(12).max(1800),
  options: z.array(z.string().trim().min(1).max(800)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(15).max(2400),
  kind: z.enum(['concept', 'application', 'troubleshooting']),
  sourceIds: z.array(z.string().min(1).max(100)).min(1).max(5),
})
export type AssessmentQuestion = z.infer<typeof QuestionSchema>
export const normalizeStem = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function validateQuestions(value: unknown, sourceIds: string[], previousStems: string[] = []): AssessmentQuestion[] {
  const { questions } = z.object({ questions: z.array(QuestionSchema).length(25) }).parse(value)
  const seen = new Set(previousStems.map(normalizeStem))
  const sourceSet = new Set(sourceIds)
  for (const q of questions) {
    const stem = normalizeStem(q.stem)
    if (seen.has(stem)) throw new Error('Repeated question. Generate another version.')
    seen.add(stem)
    if (new Set(q.options.map(normalizeStem)).size !== 4) throw new Error('Answer choices must be distinct.')
    if (q.sourceIds.some(id => !sourceSet.has(id))) throw new Error('Question references work outside this student’s evidence.')
  }
  if (questions.filter(q => q.kind === 'concept').length !== 5 || questions.filter(q => q.kind === 'application').length !== 10 || questions.filter(q => q.kind === 'troubleshooting').length !== 10) throw new Error('Questions must include 5 concepts, 10 applications and 10 troubleshooting scenarios.')
  return questions
}
export function canReadAssessment(user: { id: string; role: string }, a: { studentId: string; mode: string }) {
  return user.role === 'ADMIN' || (user.role !== 'OBSERVER' && user.id === a.studentId && a.mode === 'PRACTICE')
}
export function scoreAnswers(questions: AssessmentQuestion[], answers: unknown) {
  const selected = z.array(z.number().int().min(0).max(3)).length(25).parse(answers)
  return questions.reduce((score, q, i) => score + Number(selected[i] === q.correctIndex), 0)
}
// Explicit projection: never spread a database record into a student response.
export function publicAssessment(a: any, staff: boolean) {
  const reveal = staff || (a.mode === 'PRACTICE' && !!a.submittedAt)
  const questions = (Array.isArray(a.questions) ? a.questions : []) as AssessmentQuestion[]
  return {
    id: a.id, studentId: a.studentId, classWorkspaceId: a.classWorkspaceId, mode: a.mode, status: a.status,
    from: a.from, to: a.to, createdAt: a.createdAt, submittedAt: a.submittedAt, approvedAt: a.approvedAt, approvalMethod: a.approvalMethod,
    error: a.error, score: a.score, answers: a.answers, model: a.model,
    questions: questions.map(q => reveal ? q : ({ stem: q.stem, options: q.options, kind: q.kind })),
    ...(staff ? { sources: a.sources, references: a.references } : {}),
  }
}


// JSONB object key ordering differs from application object ordering.
export function sameQuestions(left: unknown, right: unknown): boolean {
  const a = z.array(QuestionSchema).safeParse(left), b = z.array(QuestionSchema).safeParse(right)
  return a.success && b.success && JSON.stringify(a.data) === JSON.stringify(b.data)
}

/** Read one complete JSON object, tolerating prose/fences or a provider's trailing wrapper.
 * Never repair truncated objects or invent missing answers. Schema validation follows. */
export function parseAssessmentJson(raw: string): unknown {
  if (raw.length > 150_000) throw new Error('Model response is too large.')
  const start = raw.indexOf('{')
  if (start < 0) throw new Error('No JSON object returned.')
  let depth = 0, quoted = false, escaped = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return JSON.parse(raw.slice(start, i + 1))
  }
  throw new Error('Incomplete JSON object.')
}

export function explanationWithAnswerText(q: AssessmentQuestion) {
  // Model schema specifies zero-based numeric indices. Replace positional references
  // before shuffling so explanations stay attached to the original answer text.
  return q.explanation.replace(/\b(?:[Cc]hoice|[Oo]ption|[Aa]nswer)\s+([A-D]|[0-3])\b/g, (_all, label: string) => {
    const index = /^[0-3]$/.test(label) ? Number(label) : label.toUpperCase().charCodeAt(0) - 65
    return `the choice “${q.options[index]}”`
  })
}
