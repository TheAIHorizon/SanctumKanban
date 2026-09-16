import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const postSource = () => {
  const source = readFileSync('src/app/api/tickets/route.ts', 'utf8')
  return source.slice(source.indexOf('export async function POST'), source.indexOf('// GET'))
}

test('ticket POST locks and rechecks team, class, actor membership, and assignee membership in one transaction', () => {
  const post = postSource()
  const transaction = post.indexOf('prisma.$transaction')
  const teamLock = post.indexOf('FROM "Team"', transaction)
  const classLock = post.indexOf('FROM "ClassWorkspace"', teamLock)
  const membershipLock = post.indexOf('FROM "TeamMember"', classLock)
  const permissionCheck = post.indexOf('can(', membershipLock)

  assert.ok(transaction >= 0)
  assert.ok(teamLock > transaction)
  assert.ok(classLock > teamLock)
  assert.ok(membershipLock > classLock)
  assert.ok(permissionCheck > membershipLock)
  assert.match(post.slice(transaction), /FOR UPDATE/)
  assert.match(post.slice(transaction), /tx\.teamMember\.findUnique/)
  assert.match(post.slice(transaction), /Archived class boards are read-only/)
  assert.match(post.slice(transaction), /Assignee must be a member of this team/)
  assert.doesNotMatch(post, /isTeamClassWritable/)
  assert.doesNotMatch(post, /\$queryRawUnsafe|\$executeRawUnsafe/)
})

test('ticket POST computes position and creates ticket plus created history atomically after authorization', () => {
  const post = postSource()
  const transaction = post.indexOf('prisma.$transaction')
  const permissionCheck = post.indexOf('can(', transaction)
  const highestPosition = post.indexOf('tx.ticket.findFirst', permissionCheck)
  const createTicket = post.indexOf('tx.ticket.create', highestPosition)
  const createHistory = post.indexOf('tx.ticketHistory.create', createTicket)
  const transactionEnd = post.indexOf('return created', createHistory)

  assert.ok(transaction >= 0)
  assert.ok(permissionCheck > transaction)
  assert.ok(highestPosition > permissionCheck)
  assert.ok(createTicket > highestPosition)
  assert.ok(createHistory > createTicket)
  assert.ok(transactionEnd > createHistory)
  assert.match(post.slice(highestPosition, createHistory), /completionForNewTicket/)
  assert.match(post.slice(createHistory, transactionEnd), /action:\s*['"]created['"]/)
  assert.equal((post.match(/prisma\.\$transaction/g) ?? []).length, 1)
  assert.doesNotMatch(post.slice(0, transaction), /prisma\.(?:ticket|ticketHistory|teamMember)\./)
})

test('ticket POST maps transaction races to a retryable HTTP conflict', () => {
  const post = postSource()

  assert.match(post, /isTransactionConflict\(error\)/)
  assert.match(post, /Ticket changed concurrently; reload and try again/)
  assert.match(post, /status:\s*409/)
})
