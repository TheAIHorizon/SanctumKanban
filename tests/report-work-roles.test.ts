import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkRoleReport, taskFocus, type ReportTaskLink } from '../src/lib/report-work-roles'
const role = (code: string, inScope = true) => ({ coreOrAdditional: 'Core', workRole: { code, title: code === '451' ? 'System Administrator' : 'Cyber Defense Analyst', inScope } })
const link = (id: string, ticketId: string, status: string, codes = [role('451')]): ReportTaskLink => ({ note: 'Configured and tested the service.', ticket: { id: ticketId, title: ticketId, status, team: { name: 'Test team' } }, ksat: { ksatId: id, description: 'Configure servers.', roles: codes } })
test('roles rank by distinct tasks, retain all ticket evidence and do not double-count role overlap', () => {
  const a = link('728A', 'one', 'DONE', [role('451'), role('511')])
  const report = buildWorkRoleReport([a, a, link('728A', 'two', 'DOING'), link('695', 'three', 'BACKLOG')], false)
  assert.deepEqual(report.roles.map(r => [r.code, r.taskCount, r.completedTaskCount]), [['451', 2, 1], ['511', 1, 1]])
  assert.equal(report.roles[0].tasks.find(t => t.id === '728A')?.tickets.length, 2)
  assert.equal(report.roles[0].tasks.find(t => t.id === '728A')?.tickets[0].notes.length, 1)
  assert.equal(report.totalTasks, 2)
  assert.deepEqual(report.tickets, { total: 3, done: 1, doing: 1, backlog: 1, withNotes: 3 })
  assert.equal(report.focus.reduce((sum, f) => sum + f.count, 0), 2)
})
test('course scope, absent notes, ties, missing tickets and empty data remain explicit', () => {
  const out = link('001A', 'one', 'DONE', [role('511', false)])
  const missing = { ...link('002B', 'two', 'BACKLOG'), ticket: null, note: null }
  assert.equal(buildWorkRoleReport([out], true).roles.length, 0)
  const report = buildWorkRoleReport([out, missing], false)
  assert.deepEqual(report.roles.map(r => r.code), ['451', '511'])
  assert.equal(report.roles[0].completedTaskCount, 0)
  assert.equal(report.roles[0].tasks[0].id, '002B')
  assert.equal(buildWorkRoleReport([{ ...out, note: '  ' }], false).tickets.withNotes, 0)
  assert.equal(buildWorkRoleReport([], true).totalTasks, 0)
})
test('work-focus indicators distinguish technical, governance, mixed and unclassified wording', () => {
  assert.equal(taskFocus('Install and configure database servers.'), 'Technical')
  assert.equal(taskFocus('Evaluate policy compliance and legal requirements.'), 'Policy / governance')
  assert.equal(taskFocus('Audit network configuration for compliance.'), 'Mixed technical and policy')
  assert.equal(taskFocus('Coordinate a meeting.'), 'Other / unclassified')
})
