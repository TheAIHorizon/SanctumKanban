import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('dashboard offers Gantt from class-scoped teams and forwards archived read-only state', () => {
  const source = readFileSync('src/components/dashboard/TeamGrid.tsx', 'utf8')
  assert.match(source, /setViewMode\('gantt'\)/)
  assert.match(source, /<GanttView\s+teams=\{orderedTeams\}\s+currentUser=\{currentUser\}\s+readOnly=\{readOnly\}/)
  assert.match(source, /startDate\?:/)
  assert.match(source, /dueDate\?:/)
  assert.match(source, /setViewMode\('gantt'\); router\.refresh\(\)/)
})
