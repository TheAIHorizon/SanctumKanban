import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routes = {
  list: 'src/app/api/teams/[id]/feedback/route.ts',
  item: 'src/app/api/teams/[id]/feedback/[feedbackId]/route.ts',
  replies: 'src/app/api/teams/[id]/feedback/[feedbackId]/replies/route.ts',
  acknowledge: 'src/app/api/teams/[id]/feedback/[feedbackId]/acknowledge/route.ts',
  read: 'src/app/api/teams/[id]/feedback/read/route.ts',
}

test('feedback API exposes only the requested route methods and strict parsers', () => {
  const list = readFileSync(routes.list, 'utf8')
  const item = readFileSync(routes.item, 'utf8')
  const replies = readFileSync(routes.replies, 'utf8')
  const acknowledge = readFileSync(routes.acknowledge, 'utf8')
  const read = readFileSync(routes.read, 'utf8')

  assert.match(list, /export async function GET/)
  assert.match(list, /export async function POST/)
  assert.match(list, /parseFeedbackPostInput/)
  assert.match(item, /export async function PATCH/)
  assert.doesNotMatch(item, /export async function (PUT|DELETE|POST)/)
  assert.match(item, /parsePinInput/)
  assert.match(replies, /export async function POST/)
  assert.match(replies, /parseFeedbackReplyInput/)
  assert.match(acknowledge, /export async function POST/)
  assert.match(acknowledge, /parseAcknowledgeInput/)
  assert.match(read, /export async function POST/)
  assert.match(read, /parseFeedbackReadInput/)
})

test('every feedback write authorizes after team, class, and membership locks inside a serializable transaction', () => {
  for (const file of [routes.list, routes.item, routes.replies, routes.acknowledge, routes.read]) {
    const source = readFileSync(file, 'utf8')
    const transaction = source.indexOf('prisma.$transaction')
    if (file === routes.list) {
      assert.ok(source.indexOf('export async function POST') >= 0)
      assert.ok(transaction > source.indexOf('export async function POST'))
    } else {
      assert.ok(transaction >= 0)
    }
    const locked = source.slice(transaction)
    assert.match(locked, /lockFeedbackTeamContext/)
    assert.match(source, /isolationLevel: 'Serializable'/)
    assert.match(source, /feedbackErrorResponse\(error/)
    assert.doesNotMatch(source, /\$queryRawUnsafe|\$executeRawUnsafe/, file)
  }
  const helper = readFileSync('src/lib/instructor-feedback.server.ts', 'utf8')
  assert.match(helper, /isTransactionConflict\(error\)/)
  assert.match(helper, /status: 409/)
  assert.doesNotMatch(helper, /\$queryRawUnsafe|\$executeRawUnsafe/)
  const teamLock = helper.indexOf('FROM "Team"')
  const classLock = helper.indexOf('FROM "ClassWorkspace"')
  const membershipLock = helper.indexOf('FROM "TeamMember"')
  assert.ok(teamLock >= 0 && classLock > teamLock && membershipLock > classLock)
})

test('feedback list is team-scoped and returns the specified privacy-safe response shape', () => {
  const source = readFileSync(routes.list, 'utf8')
  assert.match(source, /canReadInstructorFeedback/)
  assert.match(source, /where: \{ teamId: params\.id \}/)
  assert.match(source, /serializeFeedbackList/)
  assert.doesNotMatch(source, /authorId: true/)
  const helper = readFileSync('src/lib/instructor-feedback.server.ts', 'utf8')
  assert.match(helper, /ticket: \{ select: \{ id: true, title: true \} \}/)
  assert.doesNotMatch(helper, /authorId: true/)
})

test('acknowledgment is idempotent and read receipt validates same-team throughId then advances monotonically', () => {
  const acknowledge = readFileSync(routes.acknowledge, 'utf8')
  assert.match(acknowledge, /upsert/)
  assert.match(acknowledge, /feedbackId_userId/)

  const read = readFileSync(routes.read, 'utf8')
  assert.match(read, /teamId: params\.id/)
  assert.match(read, /through\.createdAt > existing\.readThrough/)
  assert.match(read, /teamId_userId/)
})
