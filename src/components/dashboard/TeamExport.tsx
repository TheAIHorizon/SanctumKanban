'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'

export function TeamExport({ teamId, teamName, initialView = 'detailed', initialFrom, initialTo }: { teamId: string; teamName: string; initialView?: 'detailed' | 'gantt'; initialFrom?: string; initialTo?: string }) {
  const [from, setFrom] = useState(initialFrom || new Date().toISOString().slice(0, 8) + '01')
  const [to, setTo] = useState(initialTo || new Date().toISOString().slice(0, 10))
  const [view, setView] = useState(initialView)
  const [paper, setPaper] = useState('letter')
  const url = `/api/teams/${encodeURIComponent(teamId)}/export?` + new URLSearchParams({ from, to, view, paper })
  const valid = from && to && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 <= 365
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" aria-label={`Export ${teamName}`}>Export</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Export {teamName}</DialogTitle><DialogDescription>Export this team only. Open the print view to print or save a PDF, or download a standalone HTML file.</DialogDescription></DialogHeader>
    <label>View<select aria-label="View" className="block w-full border rounded p-2 bg-background" value={view} onChange={e => setView(e.target.value as typeof view)}><option value="detailed">Detailed board</option><option value="gantt">Gantt chart</option></select></label>
    <label>From<input aria-label="From" className="block w-full border rounded p-2 bg-background" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>Through<input aria-label="Through" className="block w-full border rounded p-2 bg-background" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
    <label>Paper size<select aria-label="Paper size" className="block w-full border rounded p-2 bg-background" value={paper} onChange={e => setPaper(e.target.value)}><option value="letter">Letter · landscape (11 × 8.5 in)</option><option value="tabloid">Tabloid · landscape (17 × 11 in)</option></select></label>
    <p className="text-sm text-muted-foreground">Up to 366 days. Long charts split into readable date slices and pages. Exports include all matching active tickets in this team; on-screen search filters do not apply.</p>
    {!valid ? <p role="alert">Choose a valid date range of at most 366 days.</p> : <div className="flex gap-2"><Button asChild><a href={url} target="_blank" rel="noreferrer">Print / Save PDF</a></Button><Button asChild variant="outline"><a href={url + '&download=1'}>Download HTML</a></Button></div>}
  </DialogContent></Dialog>
}
