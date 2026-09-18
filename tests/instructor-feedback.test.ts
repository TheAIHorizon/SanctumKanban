import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAcknowledgeInstructorFeedback,
  canPinInstructorFeedback,
  canPostInstructorFeedback,
  canReadInstructorFeedback,
  canReplyToInstructorFeedback,
  MAX_FEEDBACK_BODY_LENGTH,
  MAX_FEEDBACK_REPLY_LENGTH,
  parseAcknowledgeInput,
  parseFeedbackPostInput,
  parseFeedbackReadInput,
  parseFeedbackReplyInput,
  parsePinInput,
  serializeFeedbackList,
} from '../src/lib/instructor-feedback'

test('feedback reads are private to admins and current non-observer team members', () => {
  const context = { teamMemberUserIds: ['member', 'observer', 'lead'] }

  assert.equal(canReadInstructorFeedback({ id: 'admin', role: 'ADMIN' }, context), true)
  assert.equal(canReadInstructorFeedback({ id: 'member', role: 'MEMBER' }, context), true)
  assert.equal(canReadInstructorFeedback({ id: 'lead', role: 'TEAM_LEAD' }, context), true)
  assert.equal(canReadInstructorFeedback({ id: 'observer', role: 'OBSERVER' }, context), false)
  assert.equal(canReadInstructorFeedback({ id: 'classmate', role: 'MEMBER' }, context), false)
  assert.equal(canReadInstructorFeedback({ id: 'other-team', role: 'TEAM_LEAD' }, context), false)
})

test('only ADMIN is instructional staff and may post or pin on active classes', () => {
  const active = { teamMemberUserIds: ['member', 'lead'], archived: false }
  const archived = { ...active, archived: true }

  assert.equal(canPostInstructorFeedback({ id: 'admin', role: 'ADMIN' }, active), true)
  assert.equal(canPostInstructorFeedback({ id: 'lead', role: 'TEAM_LEAD' }, active), false)
  assert.equal(canPostInstructorFeedback({ id: 'member', role: 'MEMBER' }, active), false)
  assert.equal(canPostInstructorFeedback({ id: 'admin', role: 'ADMIN' }, archived), false)
  assert.equal(canPinInstructorFeedback({ id: 'admin', role: 'ADMIN' }, active), true)
  assert.equal(canPinInstructorFeedback({ id: 'lead', role: 'TEAM_LEAD' }, active), false)
  assert.equal(canPinInstructorFeedback({ id: 'admin', role: 'ADMIN' }, archived), false)
})

test('admins and current own-team members may reply and acknowledge only while active', () => {
  const active = { teamMemberUserIds: ['member', 'observer', 'lead'], archived: false }
  const archived = { ...active, archived: true }

  for (const action of [canReplyToInstructorFeedback, canAcknowledgeInstructorFeedback]) {
    assert.equal(action({ id: 'admin', role: 'ADMIN' }, active), true)
    assert.equal(action({ id: 'member', role: 'MEMBER' }, active), true)
    assert.equal(action({ id: 'lead', role: 'TEAM_LEAD' }, active), true)
    assert.equal(action({ id: 'observer', role: 'OBSERVER' }, active), false)
    assert.equal(action({ id: 'other-team', role: 'MEMBER' }, active), false)
    assert.equal(action({ id: 'admin', role: 'ADMIN' }, archived), false)
    assert.equal(action({ id: 'member', role: 'MEMBER' }, archived), false)
  }
})

test('feedback post input is bounded, trimmed, categorized, and rejects spoofed fields', () => {
  assert.deepEqual(parseFeedbackPostInput({
    body: '  Start with the firewall rule.  ',
    category: 'GUIDANCE',
    ticketId: 'ticket-1',
    pinned: true,
  }), {
    body: 'Start with the firewall rule.',
    category: 'GUIDANCE',
    ticketId: 'ticket-1',
    pinned: true,
  })
  assert.deepEqual(parseFeedbackPostInput({ body: 'Review this', category: 'NEEDS_ATTENTION' }), {
    body: 'Review this', category: 'NEEDS_ATTENTION', ticketId: null, pinned: false,
  })
  assert.throws(() => parseFeedbackPostInput({ body: '', category: 'GUIDANCE' }), /body/i)
  assert.throws(() => parseFeedbackPostInput({ body: 'x'.repeat(MAX_FEEDBACK_BODY_LENGTH + 1), category: 'GUIDANCE' }), /at most/i)
  assert.throws(() => parseFeedbackPostInput({ body: 'ok', category: 'URGENT' }), /category/i)
  assert.throws(() => parseFeedbackPostInput({ body: 'ok', category: 'GUIDANCE', authorId: 'spoof' }), /field/i)
  assert.throws(() => parseFeedbackPostInput({ body: 'ok', category: 'GUIDANCE', ticketId: '' }), /ticketId/i)
  assert.throws(() => parseFeedbackPostInput({ body: 'ok', category: 'GUIDANCE', pinned: 'yes' }), /pinned/i)
})

test('reply, acknowledge, pin, and read request bodies are strict and bounded', () => {
  assert.deepEqual(parseFeedbackReplyInput({ body: '  Thanks  ' }), { body: 'Thanks' })
  assert.throws(() => parseFeedbackReplyInput({ body: '' }), /body/i)
  assert.throws(() => parseFeedbackReplyInput({ body: 'x'.repeat(MAX_FEEDBACK_REPLY_LENGTH + 1) }), /at most/i)
  assert.throws(() => parseFeedbackReplyInput({ body: 'ok', authorName: 'spoof' }), /field/i)
  assert.deepEqual(parseAcknowledgeInput({}), {})
  assert.throws(() => parseAcknowledgeInput({ userId: 'spoof' }), /field/i)
  assert.deepEqual(parsePinInput({ pinned: false }), { pinned: false })
  assert.throws(() => parsePinInput({ pinned: false, body: 'edit' }), /field/i)
  assert.deepEqual(parseFeedbackReadInput({ throughId: 'post-1' }), { throughId: 'post-1' })
  assert.throws(() => parseFeedbackReadInput({ throughId: '' }), /throughId/i)
})

test('feedback list exposes scoped shape plus per-user acknowledgment and unread state', () => {
  const posts = [
    {
      id: 'new', body: 'new body', category: 'ACTION_REQUIRED' as const, pinned: true,
      createdAt: new Date('2026-09-17T12:00:00.000Z'), authorName: 'Ada Admin',
      ticket: { id: 'ticket-1', title: 'Firewall' },
      replies: [{ id: 'reply-1', body: 'On it', createdAt: new Date('2026-09-17T12:05:00.000Z'), authorName: 'Mia Member' }],
      acknowledgments: [{ userId: 'member', userName: 'Mia Member', createdAt: new Date('2026-09-17T12:06:00.000Z') }],
    },
    {
      id: 'old', body: 'old body', category: 'GUIDANCE' as const, pinned: false,
      createdAt: new Date('2026-09-17T10:00:00.000Z'), authorName: 'Ada Admin',
      ticket: null, replies: [], acknowledgments: [],
    },
  ]

  assert.deepEqual(serializeFeedbackList(posts, 'member', new Date('2026-09-17T11:00:00.000Z')), {
    posts: [
      { ...posts[0], acknowledgedByMe: true, isUnread: true },
      { ...posts[1], acknowledgedByMe: false, isUnread: false },
    ],
    unreadCount: 1,
  })
  assert.equal(serializeFeedbackList(posts, 'member', null).unreadCount, 2)
})
