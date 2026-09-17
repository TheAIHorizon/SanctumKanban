import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

test('ticket UI propagates read-only actual-start fields into the editor', () => {
  for (const path of [
    'src/components/dashboard/TeamGrid.tsx',
    'src/components/kanban/TeamKanban.tsx',
    'src/components/kanban/KanbanBoard.tsx',
    'src/components/kanban/TicketCard.tsx',
    'src/components/kanban/EditTicketDialog.tsx',
  ]) {
    const source = read(path)
    assert.match(source, /startedAt\?:/i, path)
    assert.match(source, /startDateAutoFilled\?:/i, path)
  }
  const editor = read('src/components/kanban/EditTicketDialog.tsx')
  assert.match(editor, /<TicketStartDetails/)
  assert.match(editor, /startDateAutoFilled:\s*ticket\.startDateAutoFilled/)
})

test('Gantt renders actual-start label, circle marker, and variance while preserving completion visuals', () => {
  const source = read('src/components/dashboard/GanttView.tsx')
  assert.match(source, /layoutGanttStart/)
  assert.match(source, /Actual start \(UTC\)/)
  assert.match(source, /rounded-full/)
  assert.match(source, /Started/)
  assert.match(source, /Actual finish/)
  assert.match(source, /layoutGanttCompletion/)
  assert.match(source, /Unscheduled/)
})

test('Gantt distinguishes automatic schedule starts from manual plans', () => {
  const source = read('src/components/dashboard/GanttView.tsx')

  assert.match(source, /ticket\.startDateAutoFilled \? 'Automatic start' : 'Planned start'/)
  assert.match(source, /ticket\.startDateAutoFilled && 'border-2 border-dashed/)
  assert.match(source, /Automatic start to expected end/)
  assert.match(source, /Solid bars: planned start to expected end/)
  assert.match(source, /Dashed outline: automatic start to expected end/)
})

test('ticket editor explains an automatically supplied start date', () => {
  const source = read('src/components/kanban/EditTicketDialog.tsx')

  assert.match(source, /ticket\.startDateAutoFilled &&/)
  assert.match(source, /filled automatically when the ticket first entered Doing/i)
  assert.match(source, /Edit it to set a planned start/i)
})
