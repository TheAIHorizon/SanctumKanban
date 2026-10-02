'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { credentialCsv, ROSTER_TEMPLATE, type InitialCredential, type RosterPreviewRow } from '@/lib/student-roster'
import { canvasRosterColumns, convertCanvasRoster, normalizeRosterHeader, type CanvasRosterMapping } from '@/lib/canvas-roster'
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
type Preview = { previewHash: string; rows: RosterPreviewRow[] }
type Result = { created: number; enrolled: number; skipped: number; credentials: InitialCredential[]; boardsCreated: number; boardsKept: number }
export function StudentRosterImport({ classId, className, onComplete, onClose }: { classId: string; className: string; onComplete: () => void; onClose: () => void }) {
  const [individualBoards, setIndividualBoards] = useState(false)
  const [csv, setCsv] = useState(''), [preview, setPreview] = useState<Preview | null>(null), [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [downloaded, setDownloaded] = useState(false)
  const [format, setFormat] = useState('standard'), [columns, setColumns] = useState<string[]>([]), [canvasNote, setCanvasNote] = useState('')
  const [mapping, setMapping] = useState<CanvasRosterMapping>({ email: -1, firstName: -1, lastName: -1, fullName: -1, nameFormat: 'separate' })
  const unsavedCredentials = !!result?.credentials.length && !downloaded
  useEffect(() => {
    if (!unsavedCredentials) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [unsavedCredentials])
  async function upload(file?: File) {
    setPreview(null); setCsv(''); setError(''); setCanvasNote(''); setColumns([])
    if (!file) return
    if (file.size > 1000000 || !file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file smaller than 1 MB. In Excel, use Save As > CSV UTF-8.'); return }
    try {
      const text = await file.text(), detected = canvasRosterColumns(text)
      const keys = detected.headers.map(normalizeRosterHeader)
      setFormat(keys.length === 3 && ['firstname', 'lastname', 'email'].every(k => keys.includes(k)) ? 'standard' : 'canvas')
      setColumns(detected.headers); setMapping(detected.mapping); setCsv(text)
    } catch (e) { setError((e as Error).message || 'The file could not be read. Select it again.') }
  }
  async function submit(action: 'preview' | 'import') {
    setBusy(true); setError('')
    try {
      const roster = format === 'canvas' ? convertCanvasRoster(csv, mapping) : { csv, skippedMetadata: 0 }
      setCanvasNote(format === 'canvas' ? `Canvas file: ${roster.skippedMetadata} leading Gradebook metadata rows ignored. Only first name, last name and email are sent to the Kanban; grades and other columns are excluded.` : '')
      const response = await fetch(`/api/classes/${classId}/students/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, individualBoards, csv: roster.csv, previewHash: preview?.previewHash }) })
      const body = await response.json()
      if (!response.ok) { if (action === 'import') setPreview(null); throw new Error(body.error || 'Import failed.') }
      if (action === 'preview') setPreview(body)
      else { setResult(body); setPreview(null); setCsv(''); onComplete() }
    } catch (e) {
      if (action === 'import') setPreview(null)
      setError(((e as Error).message || 'Connection interrupted.') + (action === 'import' ? ' Preview again to check enrollment before retrying. If new account passwords were not received, reset them in Users.' : ''))
    }
    finally { setBusy(false) }
  }
  const changeMapping = (change: Partial<CanvasRosterMapping>) => { setMapping(m => ({ ...m, ...change })); setPreview(null); setCanvasNote(''); setError('') }
  const columnPicker = (label: string, key: 'email' | 'firstName' | 'lastName' | 'fullName') => <label className="block text-sm">{label}<select aria-label={label} className="block w-full rounded border bg-background p-2 mt-1" disabled={busy} value={mapping[key]} onChange={e => changeMapping({ [key]: Number(e.target.value) })}><option value={-1}>Choose column</option>{columns.map((name, i) => <option value={i} key={i}>{i + 1}. {name || '(blank header)'}</option>)}</select></label>
  return <section aria-label="Import students" className="rounded-lg border bg-card p-5 space-y-4">
    <div className="flex flex-col sm:flex-row sm:justify-between gap-3"><h2 className="text-xl font-semibold">Import students into {className}</h2><Button className="self-start shrink-0" variant="ghost" disabled={busy || unsavedCredentials} onClick={onClose}>Close import</Button></div>
    <p className="text-sm">Upload our three-column CSV or a Canvas Class Roster / Gradebook CSV. Excel users: save as CSV UTF-8. Import up to 100 students at a time. Existing student accounts keep their names, passwords, roles, and work.</p>
    <Button variant="outline" onClick={() => download(ROSTER_TEMPLATE, 'student-roster-template.csv')}>Download CSV template</Button>
    {!result && <><label className="block">Student roster CSV<input aria-label="Student roster CSV" className="block mt-2 max-w-full" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label></>}
    {!result && !!csv && <label className="block text-sm">Roster format<select aria-label="Roster format" className="block w-full rounded border bg-background p-2 mt-1" disabled={busy} value={format} onChange={e => { setFormat(e.target.value); setPreview(null); setCanvasNote(''); setError('') }}><option value="standard">Standard three-column CSV</option><option value="canvas">Canvas roster / Gradebook CSV</option></select></label>}
    {!result && !!csv && format === 'canvas' && <div className="rounded border p-3 space-y-3">
      <h3 className="font-semibold">Canvas column mapping</h3>
      <p className="text-sm">Prefer Canvas Course Analytics → Reports → Class Roster. Select a column containing full email addresses. SIS numbers and usernames are not email addresses; no email domain is guessed.</p>
      {columnPicker('Email column', 'email')}
      <label className="block text-sm">Name format<select aria-label="Name format" className="block w-full rounded border bg-background p-2 mt-1" disabled={busy} value={mapping.nameFormat} onChange={e => changeMapping({ nameFormat: e.target.value as CanvasRosterMapping['nameFormat'] })}><option value="separate">Separate first and last name columns</option><option value="last-first">Last, First (Canvas sortable name)</option><option value="first-last">First Last (split at first space)</option></select></label>
      {mapping.nameFormat === 'separate' ? <>{columnPicker('First name column', 'firstName')}{columnPicker('Last name column', 'lastName')}</> : columnPicker('Full name column', 'fullName')}
      <p className="text-sm">Check the parsed names in the preview. For compound names or suffixes, use separate First name and Last name columns if the selected split is incorrect. Remove any Test Student row without an email before uploading.</p>
    </div>}
    {!result && <label className="block rounded border p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={individualBoards} disabled={busy} onChange={e => { setIndividualBoards(e.target.checked); setPreview(null) }} />One Kanban per student</span><span className="block mt-2 text-muted-foreground">Create a separate board for each imported student, including students already enrolled. Existing individual boards are reused; existing team work stays intact. Classmates can still view boards.</span></label>}
    {!result && <Button disabled={busy || !csv} onClick={() => submit('preview')}>{busy ? 'Working…' : 'Preview roster'}</Button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {canvasNote && <p className="text-sm text-muted-foreground">{canvasNote}</p>}
    {preview && <>
      <p role="status">{preview.rows.filter(r => r.action === 'CREATE').length} new accounts · {preview.rows.filter(r => r.action === 'ENROLL').length} existing accounts to enroll · {preview.rows.filter(r => r.action === 'SKIP').length} already enrolled</p>
      {individualBoards && <p>{preview.rows.filter(r => r.boardAction === 'CREATE').length} individual boards to create · {preview.rows.filter(r => r.boardAction === 'KEEP').length} existing boards to keep</p>}
      <div className="hidden sm:block overflow-x-auto max-h-96"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Student</th><th className="p-2">Email</th><th className="p-2">Action</th></tr></thead><tbody>{preview.rows.map(r => <tr className="border-t" key={r.email}><td className="p-2">{r.firstName} {r.lastName}{r.warning && <p className="text-muted-foreground">{r.warning}</p>}</td><td className="p-2">{r.email}</td><td className="p-2">{{ CREATE: 'Create student account and enroll', ENROLL: 'Enroll existing account', SKIP: 'Already enrolled' }[r.action]}{r.boardAction !== 'NONE' && <p>{r.boardAction === 'CREATE' ? 'Create individual board' : 'Keep individual board'}</p>}</td></tr>)}</tbody></table></div>
      <ul className="sm:hidden max-h-96 overflow-y-auto space-y-2">{preview.rows.map(r => <li className="rounded border p-3 text-sm space-y-1" key={r.email}><p className="font-medium">{r.firstName} {r.lastName}</p><p className="break-all">{r.email}</p><p>{{ CREATE: 'Create student account and enroll', ENROLL: 'Enroll existing account', SKIP: 'Already enrolled' }[r.action]}</p>{r.boardAction !== 'NONE' && <p>{r.boardAction === 'CREATE' ? 'Create individual board' : 'Keep individual board'}</p>}{r.warning && <p className="text-muted-foreground">{r.warning}</p>}</li>)}</ul>
      <p className="text-sm">New accounts receive individual initial passwords. Download the login sheet immediately after import and share each student’s own login privately. Passwords cannot be retrieved later; ask students to change them in Profile. The board option above controls whether individual boards are created.</p>
      <Button disabled={busy || preview.rows.every(r => r.action === 'SKIP' && r.boardAction !== 'CREATE')} onClick={() => submit('import')}>{busy ? 'Importing students…' : 'Import reviewed students'}</Button>
    </>}
    {result && <div className="space-y-3">
      <p role="status">Import complete: {result.created} accounts created, {result.enrolled} students enrolled, {result.skipped} already enrolled.</p>
      {!!result.credentials.length && <><Button onClick={() => { download(credentialCsv(result.credentials), 'new-student-logins.csv'); setDownloaded(true) }}>Download new student logins</Button><p className="text-sm">This private download includes initial passwords for newly created accounts only. Keep it secure; do not distribute the full sheet to students. This page retains it only until you leave.</p></>}
      <p className="text-sm">{individualBoards ? `${result.boardsCreated} individual boards created; ${result.boardsKept} existing boards kept. Open this class on the dashboard to see each student’s board.` : 'Students are enrolled in this class. Use Teams for group boards, or One Kanban per student on the class card.'}</p>
      <Button variant="outline" disabled={unsavedCredentials} onClick={() => { setResult(null); setDownloaded(false); setCanvasNote('') }}>Import another file</Button>
    </div>}
    <a className="text-sm underline block" href="/help/instructor-tools">Student import help</a>
  </section>
}
