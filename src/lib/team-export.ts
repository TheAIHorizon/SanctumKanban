import { addCalendarDays, dateKey, differenceInCalendarDays, layoutGanttBar } from './gantt'

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export interface ExportOptions { from: string; to: string; view: 'detailed' | 'gantt'; paper: 'letter' | 'tabloid' }
export function parseExportOptions(params: URLSearchParams): ExportOptions {
  const from = params.get('from') || '', to = params.get('to') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !dateKey(from) || !dateKey(to) || from > to || differenceInCalendarDays(to, from) > 365) throw new Error('Choose a valid date range of at most 366 days.')
  const view = params.get('view') || 'detailed', paper = params.get('paper') || 'letter'
  if (view !== 'detailed' && view !== 'gantt') throw new Error('Invalid export view.')
  if (paper !== 'letter' && paper !== 'tabloid') throw new Error('Invalid paper size.')
  return { from, to, view, paper }
}
type DateValue = Date | string | null
export interface ExportTicket {
  id: string; title: string; description: string | null; status: string
  startDate?: DateValue; dueDate?: DateValue; startedAt?: DateValue; completedAt?: DateValue; createdAt?: DateValue; updatedAt?: DateValue; startDateAutoFilled?: boolean
  assignee: { firstName: string; lastName: string } | null
}
const day = (value?: DateValue) => value ? dateKey(value) : null
export function ticketInExportRange(t: Partial<ExportTicket>, o: ExportOptions) {
  const start = day(t.startDate), end = day(t.dueDate)
  if (start && end) {
    const points = [start, end, day(t.startedAt), day(t.completedAt)].filter((v): v is string => !!v).sort()
    return points[0] <= o.to && points[points.length - 1] >= o.from
  }
  return [t.startDate, t.dueDate, t.startedAt, t.completedAt, t.createdAt, t.updatedAt].some(value => { const d = day(value); return d && d >= o.from && d <= o.to })
}
export function printableDocument(title: string, body: string, paper: 'letter' | 'tabloid', extraCss = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page{size:${paper === 'tabloid' ? '17in 11in' : '11in 8.5in'};margin:0.4in}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;background:white;margin:24px}h1{font-size:22px}h2{font-size:16px}p{line-height:1.45}button{padding:10px;margin-right:12px;cursor:pointer}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aab3c2;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#edf1f7}thead{display:table-header-group}.sheet{break-after:page;margin-bottom:32px}.sheet:last-child{break-after:auto}.muted{color:#48566a}.text{white-space:pre-wrap;overflow-wrap:anywhere}.ticket{break-inside:avoid;border:1px solid #b9c1cd;padding:10px;margin:10px 0}.tools{margin-bottom:24px} @media print{body{margin:0}.tools{display:none}.sheet{margin-bottom:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}${extraCss}</style></head><body><div class="tools"><button onclick="window.print()">Print / Save PDF</button><span>Landscape · ${paper === 'tabloid' ? 'Tabloid (17 × 11 in)' : 'Letter (11 × 8.5 in)'}. Choose the same paper size in your print dialog. Save this page as HTML for an offline copy.</span></div>${body}</body></html>`
}
export function renderTeamExport(team: { name: string; className: string; tickets: ExportTicket[] }, o: ExportOptions) {
  const e = escapeHtml, tickets = team.tickets.filter(t => ticketInExportRange(t, o))
  const heading = (range = `${o.from} to ${o.to}`) => `<h1>${e(team.name)} — ${o.view === 'gantt' ? 'Gantt chart' : 'Detailed board'}</h1><p>${e(team.className)} · ${e(range)} · Generated ${e(new Date().toISOString().slice(0, 10))} (UTC)</p>`
  const who = (t: ExportTicket) => t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Unassigned'
  const details = (t: ExportTicket) => `Start: ${day(t.startDate) || 'unscheduled'}${t.startDateAutoFilled ? ' (automatic)' : ''} · Due: ${day(t.dueDate) || 'unscheduled'} · Actual start: ${day(t.startedAt) || 'unknown'} · Completed: ${day(t.completedAt) || 'not recorded'}`
  const scope = '<p class="muted">Active tickets only. Dated tickets are included when their schedule or recorded start/completion span overlaps the range. Partially dated or unscheduled tickets are included when a date or creation/update falls within the range. Dates use UTC calendar days. Private feedback and student reports are excluded.</p>'
  let body = ''
  if (o.view === 'detailed') {
    body = heading() + scope + ['BACKLOG', 'DOING', 'DONE'].map(status => `<h2>${status}</h2>${tickets.filter(t => t.status === status).map(t => `<article class="ticket"><h3>${e(t.title)}</h3><p>${e(who(t))} · ${e(details(t))}</p><div class="text">${e(t.description || 'No description.')}</div></article>`).join('') || '<p>No matching tickets.</p>'}`).join('')
  } else {
    const scheduled = tickets.filter(t => t.startDate && t.dueDate)
    const daysPerPage = o.paper === 'tabloid' ? 28 : 14, rowsPerPage = o.paper === 'tabloid' ? 16 : 10
    for (let start = o.from; start <= o.to; start = dateKey(addCalendarDays(start, daysPerPage))!) {
      const end = [dateKey(addCalendarDays(start, daysPerPage - 1))!, o.to].sort()[0]
      const dates = Array.from({ length: differenceInCalendarDays(end, start) + 1 }, (_, i) => dateKey(addCalendarDays(start, i))!)
      const rows = scheduled.filter(t => ticketInExportRange(t, { ...o, from: start, to: end }))
      for (let offset = 0; offset < Math.max(rows.length, 1); offset += rowsPerPage) {
        body += `<section class="sheet">${heading(`${start} to ${end}`)}<p class="muted">Requested range: ${o.from} to ${o.to}. Rows ${rows.length ? offset + 1 : 0}–${Math.min(offset + rowsPerPage, rows.length)} of ${rows.length}. Bar = schedule; ● = actual start; ◆ = completion. Automatic starts are labeled. Dates outside this slice are clipped.</p><table><thead><tr><th style="width:30%">Ticket / assignee / status</th><th><div class="ticks">${dates.map(d => `<span>${d.slice(5)}</span>`).join('')}</div></th></tr></thead><tbody>`
        body += rows.slice(offset, offset + rowsPerPage).map(t => {
          const bar = layoutGanttBar(t.startDate!, t.dueDate!, { start, end })
          const marker = (value: DateValue | undefined, symbol: string) => { const d = day(value); return d && d >= start && d <= end ? `<span class="marker" style="left:${(differenceInCalendarDays(d, start) + 0.5) / dates.length * 100}%">${symbol}</span>` : '' }
          return `<tr><td><b>${e(t.title)}</b><br>${e(who(t))} · ${e(t.status)}${t.startDateAutoFilled ? '<br>Automatic start' : ''}</td><td><div class="track">${bar ? `<div class="bar" style="left:${bar.leftPercent}%;width:${bar.widthPercent}%"></div>` : ''}${marker(t.startedAt, '●')}${marker(t.completedAt, '◆')}</div></td></tr>`
        }).join('') || '<tr><td colspan="2">No scheduled tickets in this slice.</td></tr>'
        body += '</tbody></table></section>'
      }
    }
    // Full titles and event dates are available even when a chart label wraps.
    body += `<section>${heading()}${scope}<h2>Ticket dates and unscheduled work</h2>${tickets.map(t => `<article class="ticket"><b>${e(t.title)}</b> — ${e(who(t))} · ${e(t.status)}<p>${e(details(t))}</p></article>`).join('') || '<p>No matching tickets.</p>'}</section>`
  }
  return printableDocument(team.name, body, o.paper, '.ticks{display:flex;justify-content:space-around;font-size:9px}.track{height:25px;position:relative;background:repeating-linear-gradient(90deg,#f1f4f8 0,#f1f4f8 1px,transparent 1px,transparent 7%)}.bar{position:absolute;top:9px;height:9px;background:#5a7cb2;border:1px solid #344e79}.marker{position:absolute;top:2px;transform:translateX(-50%);font-size:17px}.sheet td{height:38px;font-size:11px}')
}
