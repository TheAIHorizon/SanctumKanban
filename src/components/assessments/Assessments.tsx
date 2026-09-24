'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AssessmentQuestion } from '@/lib/assessments'

type Question = Omit<AssessmentQuestion, 'correctIndex' | 'explanation' | 'sourceIds'> & Partial<Pick<AssessmentQuestion, 'correctIndex' | 'explanation' | 'sourceIds'>>
type Version = { id: string; mode: string; status: string; from: string; to: string; createdAt: string; submittedAt: string | null; score: number | null; error: string | null }
type Detail = Version & { questions: Question[]; answers: number[] | null; approvalMethod: string | null; references?: string; sources?: { id: string; title: string; description: string; contribution: string; tasks: { code: string; description: string; note: string }[] }[] }
type Course = { id: string; name: string; archived: boolean; students: { id: string; name: string }[] }
const field = 'block w-full rounded border bg-background p-2'
async function readResponse(response: Response) { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Request failed.'); return body }
export function Assessments({ staff, userId, classes }: { staff: boolean; userId: string; classes: Course[] }) {
  const [classId, setClassId] = useState(classes.find(c => !c.archived)?.id || classes[0]?.id || '')
  const course = classes.find(c => c.id === classId)
  const [studentId, setStudentId] = useState(staff ? course?.students[0]?.id || '' : userId)
  const [mode, setMode] = useState(staff ? 'EXAM' : 'PRACTICE')
  const [from, setFrom] = useState(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [references, setReferences] = useState('')
  const [versions, setVersions] = useState<Version[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [answers, setAnswers] = useState<number[]>(Array(25).fill(-1))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    setDetail(null); setSelectedId(null); setVersions([]); setError('')
  }, [classId, studentId])
  useEffect(() => {
    if (!classId || !studentId) return
    let canceled = false
    const load = async () => { try { const result = await readResponse(await fetch('/api/assessments?' + new URLSearchParams({ classId, studentId }))); if (!canceled) setVersions(result) } catch (e) { if (!canceled) setError((e as Error).message) } }
    void load(); const timer = setInterval(load, 5000)
    return () => { canceled = true; clearInterval(timer) }
  }, [classId, studentId, refresh])
  const selectedStatus = versions.find(v => v.id === selectedId)?.status
  useEffect(() => {
    if (!selectedId) return
    let canceled = false
    void fetch(`/api/assessments/${selectedId}`).then(readResponse).then(value => { if (!canceled) { setDetail(value); setAnswers(value.answers || Array(25).fill(-1)) } }).catch(e => { if (!canceled) setError(e.message) })
    return () => { canceled = true }
  }, [selectedId, selectedStatus])
  async function generate() {
    setBusy(true); setError('')
    try { const result = await readResponse(await fetch('/api/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, studentId, mode, from, to, references }) })); setDetail(result); setSelectedId(result.id); setRefresh(n => n + 1) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function act(action: string) {
    if (!detail) return
    setBusy(true); setError('')
    try { const result = await readResponse(await fetch(`/api/assessments/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, answers, questions: detail.questions }) })); setDetail(result); setRefresh(n => n + 1) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function edit(index: number, change: Partial<Question>) { setDetail(d => d && ({ ...d, questions: d.questions.map((q, i) => i === index ? { ...q, ...change } : q) })) }
  const editable = staff && detail?.mode === 'EXAM' && detail.status === 'READY' && !course?.archived
  return <div className="space-y-6 max-w-5xl mx-auto py-6">
    <h1 className="text-2xl font-bold">{staff ? 'Assessments' : 'Practice tests'}</h1>
    <p>Each new version contains 25 multiple-choice questions about documented student work: 5 concepts, 10 applications, and 10 troubleshooting scenarios. Questions and answers are AI-generated and may contain errors. Practice scores are study feedback, not course grades.</p>
    <div className="grid sm:grid-cols-2 gap-4 rounded border p-4">
      <label>Course<select aria-label="Course" className={field} value={classId} onChange={e => { const id = e.target.value; setClassId(id); setStudentId(staff ? classes.find(c => c.id === id)?.students[0]?.id || '' : userId) }}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (archived)' : ''}</option>)}</select></label>
      {staff && <><label>Student<select aria-label="Student" className={field} value={studentId} onChange={e => setStudentId(e.target.value)}>{course?.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Test type<select aria-label="Test type" className={field} value={mode} onChange={e => setMode(e.target.value)}><option value="EXAM">Instructor exam draft</option><option value="PRACTICE">Student practice test</option></select></label></>}
      <label>Work from<input className={field} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Work through<input className={field} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      {staff && <label className="sm:col-span-2">Optional instructor reference material<textarea className={field} rows={4} maxLength={20000} value={references} onChange={e => setReferences(e.target.value)} placeholder="Paste course notes, excerpts, or expected procedures. Links alone are not fetched." /></label>}
      <p className="sm:col-span-2 text-sm text-muted-foreground">Uses the student’s assigned Doing/Done tickets with recorded activity in this date range, plus their own dated DCWF task notes. Ticket creation for someone else and whole-team reflections do not count as personal work. Up to 30 recent substantive tickets are used, including archived tickets. Questions avoid exact stems from the last five successful versions; topics can recur.</p>
      <Button disabled={busy || !studentId || !classId || course?.archived || versions.some(v => ['QUEUED', 'GENERATING'].includes(v.status))} onClick={generate}>Generate new {mode === 'EXAM' ? 'exam draft' : 'practice test'}</Button>
      {course?.archived && <p>Archived course: saved tests are read only.</p>}
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div><h2 className="text-xl font-semibold mb-2">Saved versions</h2><div className="flex flex-wrap gap-2">{versions.map(v => <Button variant={selectedId === v.id ? 'secondary' : 'outline'} key={v.id} onClick={() => { setSelectedId(v.id); setError('') }}>{new Date(v.createdAt).toLocaleString()} · {v.mode === 'EXAM' ? 'Exam' : 'Practice'} · {v.status}{v.score != null ? ` · ${v.score}/25` : ''}</Button>)}</div>{!versions.length && <p>No saved versions for this student and course.</p>}</div>
    {detail && <section className="space-y-4" aria-label="Selected test">
      <h2 className="text-xl font-semibold">{detail.mode === 'EXAM' ? 'Instructor exam' : 'Practice test'} · {detail.status}</h2>
      <p className="text-sm">Work range: {detail.from} through {detail.to} · Version {detail.id}</p>
      {['QUEUED', 'GENERATING'].includes(detail.status) && <><p role="status">{detail.status === 'QUEUED' ? 'Queued for the local assessment worker.' : 'Creating and validating 25 questions.'} This can take several minutes. You can leave this page and return. If this stays queued, the operator needs to start the assessment worker.</p>{!course?.archived && <Button variant="outline" disabled={busy} onClick={() => act('cancel')}>Cancel generation</Button>}</>}
      {detail.error && <p role="status">{detail.error}</p>}
      {detail.submittedAt && <p className="font-semibold">Practice score: {detail.score}/25. Answers are now shown below.</p>}
      {detail.questions.map((q, i) => <fieldset className="rounded border p-4 space-y-2" key={i}><legend className="px-2 font-semibold">Question {i + 1} · {q.kind}</legend>
        {editable ? <label>Question {i + 1} text<textarea aria-label={`Question ${i + 1} text`} className={field} value={q.stem} onChange={e => edit(i, { stem: e.target.value })} /></label> : <p className="font-medium">{q.stem}</p>}
        {q.options.map((o, j) => editable ? <label key={j}>Option {'ABCD'[j]}<input className={field} value={o} onChange={e => edit(i, { options: q.options.map((v, k) => k === j ? e.target.value : v) })} /></label> : <label key={j} className="block"><input type="radio" name={`question-${i}`} checked={answers[i] === j} onChange={() => setAnswers(a => a.map((v, k) => k === i ? j : v))} disabled={!!detail.submittedAt || detail.mode === 'EXAM' || staff && studentId !== userId || course?.archived} /> <span>{'ABCD'[j]}. {o}</span></label>)}
        {editable ? <><label>Correct answer<select className={field} value={q.correctIndex} onChange={e => edit(i, { correctIndex: Number(e.target.value) })}>{q.options.map((_, j) => <option key={j} value={j}>{'ABCD'[j]}</option>)}</select></label><label>Explanation<textarea className={field} value={q.explanation} onChange={e => edit(i, { explanation: e.target.value })} /></label></> : q.correctIndex != null && <p className="rounded bg-muted p-3">Correct: {'ABCD'[q.correctIndex]}. {q.explanation}</p>}
        {staff && q.sourceIds && <p className="text-xs text-muted-foreground">Based on: {q.sourceIds.map(id => detail.sources?.find(s => s.id === id)?.title || id).join('; ')}</p>}
      </fieldset>)}
      {detail.status === 'READY' && detail.mode === 'PRACTICE' && !detail.submittedAt && studentId === userId && !course?.archived && <Button disabled={busy || answers.some(a => a < 0)} onClick={() => act('submit')}>Submit all 25 answers</Button>}
      {editable && <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => act('save')}>Save edits</Button><Button disabled={busy} onClick={() => act('approve')}>Accept exam</Button></div>}
      {detail.status === 'APPROVED' && staff && <div><p>Accepted exam · {detail.approvalMethod === 'EDITED' ? 'Instructor edited' : 'Generated version accepted'}. This version is fixed; generate another to make changes.</p><div className="flex gap-3 mt-2"><Button asChild><a href={`/api/assessments/${detail.id}/export`} target="_blank" rel="noreferrer">Print student exam</a></Button><Button asChild variant="outline"><a href={`/api/assessments/${detail.id}/export?key=1`} target="_blank" rel="noreferrer">Print separate answer key</a></Button></div></div>}
      {staff && detail.sources && <details><summary className="cursor-pointer">Evidence snapshot and references</summary><p className="whitespace-pre-wrap">{detail.references || 'No instructor references supplied.'}</p>{detail.sources.map(s => <article key={s.id} className="border rounded p-3 my-2"><h3 className="font-semibold">{s.title}</h3><p>{s.contribution}</p><p className="whitespace-pre-wrap">{s.description}</p>{s.tasks.map(t => <p key={t.code}>{t.code}: {t.description} — {t.note}</p>)}</article>)}</details>}
    </section>}
  </div>
}
