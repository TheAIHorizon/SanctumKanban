'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export type AssessmentSummary = { id: string; studentId: string; classWorkspaceId: string; classWorkspace: { name: string }; mode: string; status: string; from: string; to: string; createdAt: string; score: number | null; submittedAt: string | null; student: { firstName: string; lastName: string } }
const field = 'block w-full rounded border bg-background p-2'
const exportable = (a: AssessmentSummary) => a.mode === 'EXAM' ? a.status === 'APPROVED' : a.status === 'READY'
export async function downloadCanvas(body: { classId: string; ids?: string[]; latestApproved?: boolean; format: string; points: number }) {
  const response = await fetch('/api/assessments/canvas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Export failed.') }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a'); link.href = url
  link.download = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'sanctum-canvas.zip'
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
export function AssessmentLibrary({ staff, classId, students, refresh, selectedId, onSelect }: { staff: boolean; classId: string; students: { id: string; name: string }[]; refresh: number; selectedId: string | null; onSelect: (a: AssessmentSummary) => void }) {
  const [studentId, setStudentId] = useState(''), [mode, setMode] = useState(''), [status, setStatus] = useState(''), [search, setSearch] = useState('')
  const [page, setPage] = useState(1), [items, setItems] = useState<AssessmentSummary[]>([]), [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string[]>([]), [error, setError] = useState(''), [loadError, setLoadError] = useState(''), [loading, setLoading] = useState(false), [exporting, setExporting] = useState(false)
  const [format, setFormat] = useState('qti'), [points, setPoints] = useState(4)
  useEffect(() => {
    if (!classId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        const response = await fetch('/api/assessments/library?' + new URLSearchParams({ classId, studentId, mode, status, search, page: String(page) }), { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load assessments.')
        if (!controller.signal.aborted) { setItems(result.items); setTotal(result.total); setLoadError('') }
      } catch (e) { if (!controller.signal.aborted) setLoadError((e as Error).message) }
      finally { if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(load, 5000) } }
    }
    setLoading(true); timer = setTimeout(load, 200)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [classId, studentId, mode, status, search, page, refresh])
  function filter(set: (v: string) => void, value: string) { set(value); setPage(1); setSelected([]); setItems([]) }
  async function download(latestApproved = false) {
    setExporting(true); setError('')
    try { await downloadCanvas({ classId, ...(latestApproved ? { latestApproved: true } : { ids: selected }), format, points }) }
    catch (e) { setError((e as Error).message) } finally { setExporting(false) }
  }
  const eligible = items.filter(exportable)
  return <section aria-label="Assessment library" className="space-y-3 rounded border p-4">
    <h2 className="text-xl font-semibold">{staff ? 'Assessment library' : 'Saved versions'}</h2>
    <p className="text-sm text-muted-foreground">{staff ? 'Every version is saved in the Kanban database. Browse all pages to see the complete history for the selected course, or all courses.' : 'Your practice versions are saved in the Kanban database. Browse all pages to see your history for the selected course.'}</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {staff && <><label>History for student<select className={field} value={studentId} onChange={e => filter(setStudentId, e.target.value)}><option value="">All students</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Assessment type<select className={field} value={mode} onChange={e => filter(setMode, e.target.value)}><option value="">All types</option><option value="EXAM">Instructor exams</option><option value="PRACTICE">Practice tests</option></select></label></>}
      <label>Assessment status<select className={field} value={status} onChange={e => filter(setStatus, e.target.value)}><option value="">All statuses</option>{['QUEUED', 'GENERATING', 'READY', 'APPROVED', 'FAILED'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>{staff ? 'Search student or version' : 'Search version'}<input className={field} value={search} onChange={e => filter(setSearch, e.target.value)} /></label>
    </div>
    {(error || loadError) && <p role="alert" className="text-destructive">{error || loadError}</p>}
    <p aria-live="polite">{loading ? 'Loading assessments…' : `${total} saved version${total === 1 ? '' : 's'} · Page ${page} of ${Math.max(1, Math.ceil(total / 25))}`}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{staff && <th className="p-2"><input type="checkbox" aria-label="Select exportable assessments on this page" disabled={!eligible.length} checked={!!eligible.length && eligible.every(a => selected.includes(a.id))} onChange={e => setSelected(e.target.checked ? Array.from(new Set([...selected, ...eligible.map(a => a.id)])).slice(0, 100) : selected.filter(id => !eligible.some(a => a.id === id)))} /></th>}<th className="p-2">Student / course</th><th className="p-2">Version / status</th><th className="p-2">Work range</th><th className="p-2">Practice score</th></tr></thead>
      <tbody>{items.map(a => <tr key={a.id} className="border-b align-top">{staff && <td className="p-2"><input type="checkbox" aria-label={`Select ${a.student.firstName} ${a.student.lastName} ${a.id}`} disabled={!exportable(a) || (!selected.includes(a.id) && selected.length >= 100)} checked={selected.includes(a.id)} onChange={e => setSelected(s => e.target.checked ? [...s, a.id] : s.filter(id => id !== a.id))} /></td>}<td className="p-2">{a.student.firstName} {a.student.lastName}<p className="text-xs text-muted-foreground">{a.classWorkspace.name}</p></td><td className="p-2"><Button variant={selectedId === a.id ? 'secondary' : 'outline'} onClick={() => onSelect(a)}>{new Date(a.createdAt).toLocaleString()} · {a.mode === 'EXAM' ? 'Exam' : 'Practice'} · {a.status}</Button><p className="mt-1 text-xs text-muted-foreground break-all">{a.id}</p></td><td className="p-2 whitespace-nowrap">{a.from}<br />through {a.to}</td><td className="p-2">{a.score == null ? '—' : `${a.score}/25`}</td></tr>)}</tbody></table></div>
    {!loading && !items.length && <p>No saved assessments match these filters.</p>}
    <div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous page</Button><Button variant="outline" disabled={page * 25 >= total || loading} onClick={() => setPage(p => p + 1)}>Next page</Button></div>
    {staff && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Export to Canvas</h3><p className="text-sm">Select a specific course above for batch downloads, then select accepted exams or ready practice tests. Draft exams must be accepted first. Class export chooses the latest accepted exam for each student in this course, independently of the filters above.</p>
      <div className="grid sm:grid-cols-2 gap-3"><label>Canvas package<select className={field} value={format} onChange={e => setFormat(e.target.value)}><option value="qti">Classic Quizzes — combined QTI import</option><option value="individual">New Quizzes — individual quiz ZIPs in a bundle</option></select></label><label>Points per question<input className={field} type="number" min={1} max={100} step={1} value={points} onChange={e => setPoints(Number(e.target.value))} /><span className="text-sm">{points * 25} points per quiz</span></label></div>
      <div className="flex flex-wrap gap-2"><Button disabled={exporting || !selected.length || classId === 'all'} onClick={() => download()}>Export selected ({selected.length})</Button><Button variant="outline" disabled={exporting || !classId || classId === 'all'} onClick={() => download(true)}>Export latest accepted exams for class</Button>{!!selected.length && <Button variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>}</div>
      <p className="text-sm">Download up to 100 assessments at a time. Each assessment becomes a separate quiz. Before publishing in Canvas, assign it only to the intended student and check points and answer visibility. Students take it in Canvas for Canvas grading; existing Kanban scores are not transferred. Downloads contain answer keys and are for instructors only.</p>
      <a className="underline text-sm" href="/help/instructor-exams">Canvas import instructions and limitations</a>
    </div>}
  </section>
}
