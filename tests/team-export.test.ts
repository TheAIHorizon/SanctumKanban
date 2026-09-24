import test from 'node:test'
import assert from 'node:assert/strict'
import { parseExportOptions, ticketInExportRange, renderTeamExport } from '../src/lib/team-export'

test('export dates are valid, inclusive and bounded; paper and view are allowlisted', () => {
  assert.throws(() => parseExportOptions(new URLSearchParams('from=2026-02-30&to=2026-03-01')))
  assert.throws(() => parseExportOptions(new URLSearchParams('from=2026-03-02&to=2026-03-01')))
  assert.throws(() => parseExportOptions(new URLSearchParams('from=2026-01-01&to=2028-01-01')))
  assert.throws(() => parseExportOptions(new URLSearchParams('from=2026-01-01&to=2026-02-01&paper=evil')))
  const o = parseExportOptions(new URLSearchParams('from=2026-09-01&to=2026-09-30&paper=tabloid&view=gantt'))
  assert.equal(ticketInExportRange({ startDate: '2026-08-01', dueDate: '2026-09-01' }, o), true)
  assert.equal(ticketInExportRange({ startDate: '2026-08-01', dueDate: '2026-08-31' }, o), false)
  assert.equal(ticketInExportRange({ createdAt: '2026-09-30' }, o), true)
})

test('standalone export escapes content and paginates the timeline for landscape tabloid', () => {
  const options = parseExportOptions(new URLSearchParams('from=2026-09-01&to=2026-10-31&paper=tabloid&view=gantt'))
  const html = renderTeamExport({ name: '<script>alert(1)</script>', className: 'Course', tickets: [{ id: '1', title: '<img src=x onerror=alert(1)>', description: null, status: 'DOING', startDate: '2026-09-01', dueDate: '2026-10-31', assignee: null }] }, options)
  assert.ok(html.includes('size:17in 11in'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<img src=x'))
  assert.equal((html.match(/class="sheet"/g) || []).length, 3)
  assert.ok(!html.includes('https://'))
})
