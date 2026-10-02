import { createHash } from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
import { validateQuestions } from './assessments'

export type CanvasAssessment = {
  id: string; mode: string; status: string; from: string; to: string; createdAt: Date | string;
  questions: unknown; sources: unknown;
  student: { firstName: string; lastName: string }; classWorkspace: { name: string };
}
export function canvasExportable(a: { mode: string; status: string }) {
  return (a.mode === 'EXAM' && a.status === 'APPROVED') || (a.mode === 'PRACTICE' && a.status === 'READY')
}
// Plain text only, encoded once for HTML and again for its XML container.
export const xml = (value: string) => Array.from(value).filter(ch => { const n = ch.codePointAt(0)!; return n === 9 || n === 10 || n === 13 || n >= 0x20 && n <= 0xD7FF || n >= 0xE000 && n <= 0xFFFD || n >= 0x10000 && n <= 0x10FFFF }).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const material = (value: string) => `<material><mattext texttype="text/html">${xml('<p>' + xml(value).replace(/\r?\n/g, '<br/>') + '</p>')}</mattext></material>`
const meta = (name: string, value: string) => `<qtimetadatafield><fieldlabel>${name}</fieldlabel><fieldentry>${xml(value)}</fieldentry></qtimetadatafield>`
const idFor = (id: string) => 'sanctum_' + createHash('sha256').update(id).digest('hex').slice(0, 24)
export function canvasTitle(a: CanvasAssessment) {
  return `${a.classWorkspace.name} — ${a.student.firstName} ${a.student.lastName} — ${a.mode === 'EXAM' ? 'Exam' : 'Practice'} — ${a.from} to ${a.to} — ${idFor(a.id).slice(-8)}`
}
function assessmentXml(a: CanvasAssessment, points: number) {
  if (!canvasExportable(a)) throw new Error('Accept exam drafts before exporting; practice tests must be ready.')
  const sourceIds = Array.isArray(a.sources) ? a.sources.map(s => (s as { id: string }).id) : []
  const questions = validateQuestions({ questions: a.questions }, sourceIds)
  const ident = idFor(a.id)
  const items = questions.map((q, i) => {
    const itemId = `${ident}_q${i + 1}`
    const choices = q.options.map((option, j) => `<response_label ident="choice_${j}">${material(option)}</response_label>`).join('')
    return `<item ident="${itemId}" title="Question ${i + 1}">
<itemmetadata><qtimetadata>${meta('question_type', 'multiple_choice_question')}${meta('points_possible', String(points))}</qtimetadata></itemmetadata>
<presentation>${material(q.stem)}<response_lid ident="response1" rcardinality="Single"><render_choice>${choices}</render_choice></response_lid></presentation>
<resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>
<respcondition continue="No"><conditionvar><varequal respident="response1">choice_${q.correctIndex}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition></resprocessing>
<itemfeedback ident="general_fb"><flow_mat>${material(q.explanation)}</flow_mat></itemfeedback></item>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"><assessment ident="${ident}" title="${xml(canvasTitle(a))}"><qtimetadata>${meta('cc_maxattempts', '1')}</qtimetadata><section ident="${ident}_section">${items}</section></assessment></questestinterop>`
}
export const CANVAS_IMPORT_GUIDE = `Sanctum assessment export — instructor use only

This download contains correct answers. Do not distribute the ZIP to students.
Each quiz has 25 multiple-choice questions. Point values are set per question.

Classic Quizzes: Course Settings > Import Course Content > QTI .zip file.
Import a single-quiz file or the combined Classic class package. Keep overwrite
matching IDs off unless you deliberately intend to replace an earlier import.

New Quizzes: create a new quiz shell, save it, open Build > Options > Import
Content, and select that quiz's individual QTI ZIP. For a class bundle, extract
the outer ZIP first, then import each ZIP in quizzes/ into its own quiz shell.
Do not import the outer bundle as one quiz. Institution-enabled course import
migration is another option; check your Canvas settings.

Before publishing: check every question, answer key, point value, feedback
visibility and availability dates. Assign each personalized quiz ONLY to its
intended student (remove Everyone). Titles identify the student and version;
QTI does not map Sanctum users to Canvas enrollment IDs or set student overrides.
Each imported quiz is separate, so this does not create one shared final-exam
Gradebook column. Set any New Quizzes assignment points to match the quiz total.

Students take the quizzes IN CANVAS for Canvas grading. Existing Sanctum
practice attempts/scores are not imported or synchronized. Practice exports
contain quiz content only; choose their grading settings in Canvas.
No API credentials or automatic upload is needed. Ticket evidence, instructor
reference text, student responses and existing scores are not included.

Official guides:
https://community.instructure.com/en/kb/articles/660996-how-do-i-import-quizzes-from-qti-packages
https://community.instructure.com/en/kb/articles/661050-how-do-i-import-a-quiz-from-a-qti-package-in-new-quizzes
`
export function canvasQtiFiles(assessments: CanvasAssessment[], points = 4): Record<string, Uint8Array> {
  if (!assessments.length || assessments.length > 100) throw new Error('Select between 1 and 100 assessments.')
  if (!Number.isInteger(points) || points < 1 || points > 100) throw new Error('Points per question must be a whole number from 1 to 100.')
  if (new Set(assessments.map(a => a.id)).size !== assessments.length) throw new Error('Duplicate assessment selection.')
  const files: Record<string, Uint8Array> = {}
  const resources = assessments.map(a => {
    const id = idFor(a.id), path = `${id}/assessment.xml`
    files[path] = strToU8(assessmentXml(a, points))
    return `<resource identifier="${id}" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment" href="${path}"><file href="${path}"/></resource>`
  }).join('')
  files['imsmanifest.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="sanctum_manifest"><metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion></metadata><organizations/><resources>${resources}</resources></manifest>`)
  if (Object.values(files).reduce((size, file) => size + file.length, 0) > 30_000_000) throw new Error('Export is too large; select fewer assessments.')
  return files
}
export function buildCanvasExport(assessments: CanvasAssessment[], format: 'qti' | 'individual', points = 4) {
  // Validate the entire selection before producing any package; no silent omissions.
  const combined = canvasQtiFiles(assessments, points)
  if (format === 'qti') return zipSync({ ...combined, 'IMPORT-INSTRUCTIONS.txt': strToU8(CANVAS_IMPORT_GUIDE) }, { level: 6 })
  const files: Record<string, Uint8Array> = { 'IMPORT-INSTRUCTIONS.txt': strToU8(CANVAS_IMPORT_GUIDE) }
  const rows = assessments.map(a => {
    const filename = `quizzes/${idFor(a.id)}.zip`
    files[filename] = zipSync(canvasQtiFiles([a], points), { level: 6 })
    return { file: filename, title: canvasTitle(a), student: `${a.student.firstName} ${a.student.lastName}`, version: a.id, points: points * 25 }
  })
  // JSON is deliberate: names cannot become executable spreadsheet formulas.
  files['quiz-index.json'] = strToU8(JSON.stringify(rows, null, 2))
  return zipSync(files, { level: 0 })
}
