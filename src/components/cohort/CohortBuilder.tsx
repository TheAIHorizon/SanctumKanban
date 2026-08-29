'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Upload, Users, Sparkles, Wand2, CheckCircle2, AlertTriangle, Info, GripVertical, RotateCcw, Trash2 } from 'lucide-react'
import { IN_SCOPE_ROLES, SKILL_AXES } from '@/lib/cohort/roles'

const MODES = [
  { id: 'parity', label: 'Balanced / Parity', desc: 'Lift the weakest team (fairest — recommended)' },
  { id: 'coverage', label: 'Coverage', desc: 'Every capability on every team' },
  { id: 'mentorship', label: 'Mentorship', desc: 'An anchor with every group of beginners' },
  { id: 'affinity', label: 'Affinity', desc: 'Weight partner requests + schedules' },
  { id: 'specialization', label: 'Specialization', desc: 'Concentrate specialists' },
  { id: 'schedule', label: 'Schedule-first', desc: 'Meeting feasibility above all' },
]

const WEIGHT_KEYS = [
  { key: 'skillParity', label: 'Skill parity' },
  { key: 'pillarCoverage', label: 'Pillar coverage' },
  { key: 'mentorBalance', label: 'Mentor balance' },
  { key: 'requestsHonored', label: 'Requests honored' },
  { key: 'scheduleFit', label: 'Schedule fit' },
] as const

const MODE_PRESETS: Record<string, Record<string, number>> = {
  parity: { skillParity: 0.85, pillarCoverage: 0.55, mentorBalance: 0.65, requestsHonored: 0.35, scheduleFit: 0.3 },
  coverage: { skillParity: 0.4, pillarCoverage: 0.95, mentorBalance: 0.4, requestsHonored: 0.3, scheduleFit: 0.35 },
  mentorship: { skillParity: 0.55, pillarCoverage: 0.45, mentorBalance: 0.95, requestsHonored: 0.3, scheduleFit: 0.3 },
  affinity: { skillParity: 0.35, pillarCoverage: 0.4, mentorBalance: 0.35, requestsHonored: 0.95, scheduleFit: 0.8 },
  specialization: { skillParity: 0.2, pillarCoverage: 0.3, mentorBalance: 0.25, requestsHonored: 0.5, scheduleFit: 0.4 },
  schedule: { skillParity: 0.4, pillarCoverage: 0.4, mentorBalance: 0.4, requestsHonored: 0.5, scheduleFit: 0.95 },
}

const axisLabel = (k: string) => SKILL_AXES.find((a) => a.key === k)?.label || k

interface Resp { id: string; firstName: string; lastName: string; email: string; skills: any; availDays: any; partnerRequest?: string | null }
interface Member { id: string; responseId: string; isLead: boolean; response: Resp }
interface PTeam { id: string; name: string; index: number; isHolding: boolean; rationale?: string | null; metrics: any; members: Member[] }
interface Run { id: string; mode: string; score: number; metrics: any; watchList: any[]; teams: PTeam[] }
interface Cohort { id: string; name: string; term?: string | null; teamSize: number; provisioned: boolean; _count?: { responses: number; runs: number } }

export function CohortBuilder() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [responses, setResponses] = useState<Resp[]>([])
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [mode, setMode] = useState('parity')
  const [weights, setWeights] = useState(MODE_PRESETS.parity)
  const [useAi, setUseAi] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  // new cohort form
  const [newName, setNewName] = useState('')
  const [newTerm, setNewTerm] = useState('')
  const [csvText, setCsvText] = useState('')

  const loadCohorts = useCallback(async () => {
    const r = await fetch('/api/cohorts')
    if (r.ok) { const d = await r.json(); setCohorts(d.cohorts) }
    setLoading(false)
  }, [])

  useEffect(() => { loadCohorts() }, [loadCohorts])

  const openCohort = useCallback(async (id: string) => {
    setActive(id); setRun(null); setMsg(null)
    const r = await fetch(`/api/cohorts/${id}`)
    if (r.ok) {
      const d = await r.json()
      setResponses(d.cohort.responses)
      if (d.latestRun) { setRun(d.latestRun); setMode(d.latestRun.mode); setWeights(d.latestRun.weights) }
    }
  }, [])

  async function createCohort() {
    if (!newName.trim()) { setMsg('Name required'); return }
    setBusy('create')
    const r = await fetch('/api/cohorts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, term: newTerm || undefined, csv: csvText || undefined }),
    })
    setBusy(null)
    if (r.ok) {
      const d = await r.json()
      setMsg(`Created "${d.cohort.name}" — imported ${d.imported} responses`)
      setNewName(''); setNewTerm(''); setCsvText('')
      await loadCohorts()
      await openCohort(d.cohort.id)
    } else { setMsg('Create failed') }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setCsvText(await f.text())
  }

  function pickMode(m: string) { setMode(m); if (MODE_PRESETS[m]) setWeights(MODE_PRESETS[m]) }

  async function solveCohort() {
    if (!active) return
    setBusy('solve'); setMsg('Building teams… (local AI can take a minute to warm up)')
    const r = await fetch(`/api/cohorts/${active}/solve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, weights, seed: 42, ai: useAi }),
    })
    setBusy(null)
    if (r.ok) {
      const d = await r.json()
      setRun(d.run)
      setMsg(d.usedAi ? 'Teams built with AI rationale ✨' : 'Teams built (AI unavailable — used template rationale)')
    } else { const e = await r.json().catch(()=>({})); setMsg(e.error || 'Solve failed') }
  }

  // ---- interactive editing: move member between teams ----
  function moveMember(responseId: string, fromTeamId: string, toTeamId: string) {
    if (!run || fromTeamId === toTeamId) return
    setRun((prev) => {
      if (!prev) return prev
      const teams = prev.teams.map((t) => ({ ...t, members: [...t.members] }))
      const from = teams.find((t) => t.id === fromTeamId)!
      const to = teams.find((t) => t.id === toTeamId)!
      const idx = from.members.findIndex((m) => m.responseId === responseId)
      if (idx < 0) return prev
      const [m] = from.members.splice(idx, 1)
      to.members.push(m)
      return { ...prev, teams }
    })
    setMsg('Edited — remember to Save, then re-check coverage.')
  }

  function setLead(teamId: string, responseId: string) {
    setRun((prev) => {
      if (!prev) return prev
      const teams = prev.teams.map((t) => t.id === teamId
        ? { ...t, members: t.members.map((m) => ({ ...m, isLead: m.responseId === responseId })) }
        : t)
      return { ...prev, teams }
    })
  }

  async function saveEdits() {
    if (!run || !active) return
    setBusy('save')
    const teams = run.teams.map((t) => ({
      name: t.name, index: t.index, isHolding: t.isHolding, rationale: t.rationale || undefined,
      memberResponseIds: t.members.map((m) => m.responseId),
      leadResponseId: t.members.find((m) => m.isLead)?.responseId || null,
    }))
    const r = await fetch(`/api/cohorts/${active}/runs/${run.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teams }),
    })
    setBusy(null)
    if (r.ok) { const d = await r.json(); setRun(d.run); setMsg('Saved.') } else setMsg('Save failed')
  }

  async function provision() {
    if (!run || !active) return
    if (!confirm('Create real teams + student accounts from this proposal? Students get a temp password.')) return
    setBusy('provision')
    const r = await fetch(`/api/cohorts/${active}/provision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: run.id }),
    })
    setBusy(null)
    if (r.ok) {
      const d = await r.json()
      setMsg(`✅ Provisioned: ${d.created.teams} teams, ${d.created.users} new accounts (${d.created.reused} reused). Temp password: ${d.tempPassword}`)
      await loadCohorts()
    } else { const e = await r.json().catch(()=>({})); setMsg(e.error || 'Provision failed') }
  }

  // ---- client-side live metrics for the (possibly edited) teams ----
  function liveMetrics(team: PTeam) {
    const members = team.members.map((m) => m.response)
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
      .filter((d) => members.length && members.every((m) => (m.availDays || []).includes(d)))
    const covered = SKILL_AXES.filter((a) => members.some((m) => (m.skills?.[a.key] || 0) >= 3))
    const gaps = SKILL_AXES.filter((a) => !members.some((m) => (m.skills?.[a.key] || 0) >= 3))
    const anchor = members.some((m) => (m.skills?.linux || 0) >= 3 || (m.skills?.windowsAd || 0) >= 3)
    return { days, coveredCount: covered.length, gaps: gaps.map((g) => g.key), anchor }
  }

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wand2 className="h-6 w-6" /> Cohort Builder</h1>
        <p className="text-muted-foreground mt-1">Import a placement survey, let the solver + local AI propose balanced teams, edit them, then provision real accounts.</p>
      </div>

      {msg && <div className="rounded-md border bg-muted/40 px-4 py-2 text-sm">{msg}</div>}

      {/* Cohort list + create */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Cohorts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cohorts.length === 0 && <p className="text-sm text-muted-foreground">No cohorts yet — create one →</p>}
            {cohorts.map((c) => (
              <button key={c.id} onClick={() => openCohort(c.id)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-accent ${active === c.id ? 'border-primary bg-accent' : ''}`}>
                <div className="font-medium">{c.name} {c.provisioned && <CheckCircle2 className="inline h-3.5 w-3.5 text-green-600" />}</div>
                <div className="text-xs text-muted-foreground">{c.term} · {c._count?.responses ?? 0} responses · {c._count?.runs ?? 0} runs</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> New cohort</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="IST 4910 Fall 2026" /></div>
            <div><Label>Term (optional)</Label><Input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Fall 2026" /></div>
            <div>
              <Label>Placement survey CSV</Label>
              <input type="file" accept=".csv" onChange={onFile} className="block w-full text-sm mt-1 file:mr-3 file:rounded file:border file:px-2 file:py-1 file:text-sm" />
              {csvText && <p className="text-xs text-green-600 mt-1">CSV loaded ({csvText.split('\n').length - 1} rows)</p>}
            </div>
            <Button onClick={createCohort} disabled={busy === 'create'} className="w-full">
              {busy === 'create' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create & import'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Solve controls */}
      {active && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Principle &amp; weights</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => pickMode(m.id)}
                  className={`text-left rounded-md border p-3 text-sm hover:bg-accent ${mode === m.id ? 'border-primary bg-accent' : ''}`}>
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {WEIGHT_KEYS.map(({ key, label }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1"><span>{label}</span><span className="text-muted-foreground">{Math.round((weights as any)[key] * 100)}%</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={(weights as any)[key]}
                    onChange={(e) => { setWeights({ ...weights, [key]: parseFloat(e.target.value) }); setMode('custom') }}
                    className="w-full accent-primary" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Use local AI for rationale</label>
              <Button onClick={solveCohort} disabled={busy === 'solve'}>
                {busy === 'solve' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Building…</> : <><Wand2 className="mr-2 h-4 w-4" />Build teams</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watch list */}
      {run?.watchList?.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Watch list</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {run.watchList.map((w: any, i: number) => (
              <div key={i} className="flex gap-2 text-sm">
                {w.level === 'high' ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> : w.level === 'watch' ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                <div><span className="font-medium">{w.title}</span> — <span className="text-muted-foreground">{w.detail}</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Review board */}
      {run && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              {run.metrics?.completeTeams} teams · weakest avg skill {run.metrics?.weakestTeamSkill?.toFixed(1)} · drag students between teams
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={saveEdits} disabled={busy === 'save'}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save edits'}</Button>
              <Button size="sm" onClick={provision} disabled={busy === 'provision'}>{busy === 'provision' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Provisioning…</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Provision</>}</Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {run.teams.map((team) => {
              const lm = liveMetrics(team)
              return (
                <div key={team.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { const rid = e.dataTransfer.getData('rid'); const from = e.dataTransfer.getData('from'); moveMember(rid, from, team.id) }}
                  className={`rounded-lg border p-3 ${team.isHolding ? 'border-dashed border-amber-500' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{team.name}</div>
                    <div className="text-xs text-muted-foreground">{team.members.length} · {lm.days.length ? lm.days.map((d)=>d.slice(0,3)).join('/') : 'no shared day'}</div>
                  </div>
                  <div className="space-y-1 min-h-[60px]">
                    {team.members.map((m) => (
                      <div key={m.id} draggable
                        onDragStart={(e) => { e.dataTransfer.setData('rid', m.responseId); e.dataTransfer.setData('from', team.id) }}
                        className="flex items-center gap-1.5 rounded border bg-card px-2 py-1 text-sm cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{m.response.firstName} {m.response.lastName}</span>
                        <button title="Set as lead" onClick={() => setLead(team.id, m.responseId)}
                          className={`text-[10px] px-1.5 rounded ${m.isLead ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>lead</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${lm.anchor ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>{lm.anchor ? 'anchor ✓' : 'no anchor'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{lm.coveredCount}/8 covered</span>
                    {lm.days.length < 2 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">&lt;2 shared days</span>}
                  </div>
                  {team.rationale && <p className="mt-2 text-xs text-muted-foreground leading-snug">{team.rationale}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
