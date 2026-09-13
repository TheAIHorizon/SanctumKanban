import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('edit dialog refreshes controlled form state from the current ticket whenever it opens', () => {
  const source = readFileSync('src/components/kanban/EditTicketDialog.tsx', 'utf8')

  assert.match(source, /useEffect\(\(\) => \{\s*if \(open\) \{\s*setTitle\(ticket\.title\)/)
  assert.match(source, /setStatus\(ticket\.status\)/)
})

test('kanban board exposes a batch reorder callback and applies every server position', () => {
  const source = readFileSync('src/components/kanban/KanbanBoard.tsx', 'utf8')

  assert.match(source, /onTicketsReordered\?: \(positions: TicketPositionUpdate\[\]\) => void/)
  assert.match(source, /applyPositions\(result\.positions\)/)
})

test('kanban drag mutations are single-flight and refresh authoritative tickets after rollback', () => {
  const source = readFileSync('src/components/kanban/KanbanBoard.tsx', 'utf8')

  assert.match(source, /useRef\(false\)/)
  assert.match(source, /if \(dragMutationInFlight\.current\) return/)
  assert.match(source, /dragMutationInFlight\.current = true/)
  assert.match(source, /finally \{\s*dragMutationInFlight\.current = false\s*\}/)
  assert.match(source, /applyPositions\(originalPositions\)[\s\S]*router\.refresh\(\)/)
  assert.match(source, /onTicketUpdated\(ticket\)[\s\S]*router\.refresh\(\)/)
  assert.equal(source.match(/dragMutationInFlight\.current = true/g)?.length, 2)
  assert.equal(source.match(/dragMutationInFlight\.current = false/g)?.length, 2)
  assert.equal(source.match(/router\.refresh\(\)/g)?.length, 2)
})

test('ticket card uses direct accessible actions and a scrollable full-text preview', () => {
  const source = readFileSync('src/components/kanban/TicketCard.tsx', 'utf8')

  assert.match(source, /aria-label=\{`Edit \$\{ticket\.title\}`\}/)
  assert.doesNotMatch(source, /DropdownMenu/)
  assert.match(source, /role="tooltip"/)
  assert.match(source, /overflow-y-auto/)
})

test('ticket mutation route keeps archived updates read-only but lets admin hard-delete before the soft-delete guard', () => {
  const source = readFileSync('src/app/api/tickets/[id]/route.ts', 'utf8')
  const deleteStart = source.indexOf('export async function DELETE')
  const deleteSource = source.slice(deleteStart)
  const hardBranch = deleteSource.indexOf('if (hard)')
  const archivedGuard = deleteSource.indexOf('if (ticket.archived)')

  assert.match(source.slice(0, deleteStart), /if \(ticket\.archived\)/)
  assert.ok(hardBranch >= 0)
  assert.ok(archivedGuard > hardBranch)
  assert.match(deleteSource, /if \(!can\(principal, 'ticket:delete-hard', ctx\)\)/)
})