import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const EXPECTED_BASE_URL = 'http://127.0.0.1:3459'
const EXPECTED_DB_HOST = '127.0.0.1'
const EXPECTED_DB_PORT = '55439'
const EXPECTED_DB_NAME = 'sanctum_ga_check'

function requireGuardedConfiguration(): { baseUrl: string; databaseUrl: string } {
  const baseUrl = process.env.GA_BASE_URL
  const databaseUrl = process.env.DATABASE_URL

  assert.equal(
    baseUrl,
    EXPECTED_BASE_URL,
    `Refusing to run: GA_BASE_URL must be exactly ${EXPECTED_BASE_URL}`
  )
  assert.ok(databaseUrl, 'Refusing to run: DATABASE_URL must be explicitly set')

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('Refusing to run: DATABASE_URL is not a valid URL')
  }

  assert.ok(
    parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:',
    'Refusing to run: DATABASE_URL must use PostgreSQL'
  )
  assert.equal(parsed.hostname, EXPECTED_DB_HOST, `Refusing to run: database host must be ${EXPECTED_DB_HOST}`)
  assert.equal(parsed.port, EXPECTED_DB_PORT, `Refusing to run: database port must be ${EXPECTED_DB_PORT}`)
  assert.equal(
    decodeURIComponent(parsed.pathname),
    `/${EXPECTED_DB_NAME}`,
    `Refusing to run: database name must be ${EXPECTED_DB_NAME}`
  )

  return { baseUrl, databaseUrl }
}

const { baseUrl } = requireGuardedConfiguration()
const prisma = new PrismaClient()

type JsonResult = {
  status: number
  data: any
}

class CookieJar {
  private readonly cookies = new Map<string, string>()

  absorb(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    assert.equal(
      typeof headers.getSetCookie,
      'function',
      'This check requires a Node fetch implementation with Headers.getSetCookie()'
    )
    for (const setCookie of headers.getSetCookie!()) {
      const pair = setCookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      if (separator < 1) continue
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      if (value) this.cookies.set(name, value)
      else this.cookies.delete(name)
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined
    return Array.from(this.cookies, ([name, value]) => `${name}=${value}`).join('; ')
  }
}

async function request(
  jar: CookieJar,
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<JsonResult> {
  const headers = new Headers(init.headers)
  const cookie = jar.header()
  if (cookie) headers.set('cookie', cookie)

  let body = init.body
  if ('json' in init) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(init.json)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    body,
    redirect: 'manual',
  })
  jar.absorb(response)
  const text = await response.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { status: response.status, data }
}

function expectStatus(result: JsonResult, expected: number, label: string): void {
  assert.equal(result.status, expected, `${label}: expected HTTP ${expected}, received ${result.status}`)
}

async function loginCredentials(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar()
  const csrf = await request(jar, '/api/auth/csrf')
  expectStatus(csrf, 200, 'credentials csrf')
  assert.equal(typeof csrf.data?.csrfToken, 'string', 'credentials csrf token missing')

  const body = new URLSearchParams({
    csrfToken: csrf.data.csrfToken,
    email,
    password,
    callbackUrl: baseUrl,
    json: 'true',
  })
  const callback = await request(jar, '/api/auth/callback/credentials?json=true', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-auth-return-redirect': '1',
    },
    body,
  })
  assert.ok([200, 302, 303].includes(callback.status), `credentials callback returned HTTP ${callback.status}`)
  return jar
}

async function loginObserver(): Promise<CookieJar> {
  const jar = new CookieJar()
  const csrf = await request(jar, '/api/auth/csrf')
  expectStatus(csrf, 200, 'observer csrf')
  assert.equal(typeof csrf.data?.csrfToken, 'string', 'observer csrf token missing')

  const body = new URLSearchParams({
    csrfToken: csrf.data.csrfToken,
    callbackUrl: baseUrl,
    json: 'true',
  })
  const callback = await request(jar, '/api/auth/callback/observer?json=true', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-auth-return-redirect': '1',
    },
    body,
  })
  assert.ok([200, 302, 303].includes(callback.status), `observer callback returned HTTP ${callback.status}`)
  return jar
}

async function sessionUser(jar: CookieJar): Promise<any> {
  const session = await request(jar, '/api/auth/session')
  expectStatus(session, 200, 'session lookup')
  assert.equal(typeof session.data?.user?.id, 'string', 'authenticated session user missing')
  return session.data.user
}

const fixture = {
  userIds: [] as string[],
  classId: undefined as string | undefined,
  teamIds: [] as string[],
  newlyCreatedWorkflowTagIds: [] as string[],
}

async function recordNewWorkflowTags(previousIds: ReadonlySet<string>): Promise<void> {
  const current = await prisma.tag.findMany({
    where: { teamId: null, name: { in: ['Required', 'Bonus / Extra'] } },
    select: { id: true },
  })
  fixture.newlyCreatedWorkflowTagIds = current
    .filter(({ id }) => !previousIds.has(id))
    .map(({ id }) => id)
}

let passCount = 0
async function check(name: string, body: () => Promise<void>): Promise<void> {
  await body()
  passCount += 1
  console.log(`PASS ${name}`)
}

async function cleanup(): Promise<void> {
  if (fixture.classId) {
    await prisma.classWorkspace.deleteMany({ where: { id: fixture.classId } })
  } else if (fixture.teamIds.length) {
    await prisma.team.deleteMany({ where: { id: { in: fixture.teamIds } } })
  }

  if (fixture.newlyCreatedWorkflowTagIds.length) {
    await prisma.tag.deleteMany({
      where: {
        id: { in: fixture.newlyCreatedWorkflowTagIds },
        tickets: { none: {} },
      },
    })
  }

  if (fixture.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: fixture.userIds } } })
  }
}

async function main(): Promise<void> {
  const suffix = randomUUID().replaceAll('-', '')
  const password = randomBytes(32).toString('base64url')
  const passwordHash = await bcrypt.hash(password, 10)
  const workflowTagsBefore = await prisma.tag.findMany({
    where: { teamId: null, name: { in: ['Required', 'Bonus / Extra'] } },
    select: { id: true },
  })
  const workflowTagIdsBefore = new Set(workflowTagsBefore.map(({ id }) => id))

  let failure: unknown
  try {
    const admin = await prisma.user.create({
      data: {
        email: `ga-admin-${suffix}@example.invalid`,
        firstName: `GAAdmin${suffix.slice(0, 8)}`,
        lastName: 'Fixture',
        role: 'ADMIN',
        color: '#dc2626',
        passwordHash,
      },
    })
    fixture.userIds.push(admin.id)

    const member = await prisma.user.create({
      data: {
        email: `ga-member-${suffix}@example.invalid`,
        firstName: `GAMember${suffix.slice(0, 8)}`,
        lastName: 'Fixture',
        role: 'MEMBER',
        color: '#2563eb',
        passwordHash,
      },
    })
    fixture.userIds.push(member.id)

    const other = await prisma.user.create({
      data: {
        email: `ga-other-${suffix}@example.invalid`,
        firstName: `GAOther${suffix.slice(0, 8)}`,
        lastName: 'Fixture',
        role: 'MEMBER',
        color: '#16a34a',
        passwordHash,
      },
    })
    fixture.userIds.push(other.id)

    const workspace = await prisma.classWorkspace.create({
      data: {
        name: `GA Class ${suffix}`,
        code: `GA-${suffix.slice(0, 10)}`,
        term: 'Disposable',
        description: `GA integration fixture ${suffix}`,
        createdById: admin.id,
        members: {
          create: [{ userId: admin.id }, { userId: member.id }, { userId: other.id }],
        },
      },
    })
    fixture.classId = workspace.id

    const memberTeam = await prisma.team.create({
      data: {
        name: `GA Member Team ${suffix}`,
        description: 'Disposable GA member team',
        classWorkspaceId: workspace.id,
        members: { create: { userId: member.id, role: 'MEMBER' } },
      },
    })
    fixture.teamIds.push(memberTeam.id)

    const otherTeam = await prisma.team.create({
      data: {
        name: `GA Other Team ${suffix}`,
        description: 'Disposable GA cross-team target',
        classWorkspaceId: workspace.id,
        members: { create: { userId: other.id, role: 'MEMBER' } },
      },
    })
    fixture.teamIds.push(otherTeam.id)

    const [adminJar, memberJar, otherJar, observerJar] = await Promise.all([
      loginCredentials(admin.email, password),
      loginCredentials(member.email, password),
      loginCredentials(other.email, password),
      loginObserver(),
    ])
    const [adminSession, memberSession, otherSession, observerSession] = await Promise.all([
      sessionUser(adminJar),
      sessionUser(memberJar),
      sessionUser(otherJar),
      sessionUser(observerJar),
    ])
    assert.equal(adminSession.id, admin.id)
    assert.equal(memberSession.id, member.id)
    assert.equal(otherSession.id, other.id)
    assert.equal(observerSession.role, 'OBSERVER')

    const observerBefore = await prisma.user.findUniqueOrThrow({ where: { id: observerSession.id } })

    await check('observer profile field update denied', async () => {
      const result = await request(observerJar, `/api/users/${observerSession.id}`, {
        method: 'PATCH',
        json: { contactInfo: `forbidden-${suffix}`, color: '#000000' },
      })
      expectStatus(result, 403, 'observer profile field update')
      const after = await prisma.user.findUniqueOrThrow({ where: { id: observerSession.id } })
      assert.equal(after.contactInfo, observerBefore.contactInfo)
      assert.equal(after.color, observerBefore.color)
    })

    await check('observer name update denied', async () => {
      const result = await request(observerJar, `/api/users/${observerSession.id}`, {
        method: 'PATCH',
        json: { firstName: `Forbidden${suffix}` },
      })
      expectStatus(result, 403, 'observer name update')
      const after = await prisma.user.findUniqueOrThrow({ where: { id: observerSession.id } })
      assert.equal(after.firstName, observerBefore.firstName)
    })

    await check('observer password update denied', async () => {
      const result = await request(observerJar, `/api/users/${observerSession.id}`, {
        method: 'PATCH',
        json: {
          password: randomBytes(24).toString('base64url'),
          currentPassword: randomBytes(24).toString('base64url'),
        },
      })
      expectStatus(result, 403, 'observer password update')
      const after = await prisma.user.findUniqueOrThrow({ where: { id: observerSession.id } })
      assert.equal(after.passwordHash, observerBefore.passwordHash)
    })

    const changedFirstName = `GAStudent${suffix.slice(0, 8)}`
    const changedContact = `ga-contact-${suffix}`
    await check('student valid profile update persists', async () => {
      const result = await request(memberJar, `/api/users/${member.id}`, {
        method: 'PATCH',
        json: { firstName: changedFirstName, contactInfo: changedContact, color: '#0f766e' },
      })
      expectStatus(result, 200, 'student profile update')
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: member.id },
        select: { firstName: true, contactInfo: true, color: true, email: true, role: true },
      })
      assert.deepEqual(stored, {
        firstName: changedFirstName,
        contactInfo: changedContact,
        color: '#0f766e',
        email: member.email,
        role: 'MEMBER',
      })
    })

    let firstTicketId = ''
    let secondTicketId = ''
    let thirdTicketId = ''
    await check('student ticket creation persists', async () => {
      const first = await request(memberJar, '/api/tickets', {
        method: 'POST',
        json: {
          title: `GA Student First ${suffix}`,
          description: `Created over HTTP ${suffix}`,
          teamId: memberTeam.id,
          assigneeId: member.id,
          status: 'BACKLOG',
        },
      })
      expectStatus(first, 200, 'first student ticket create')
      firstTicketId = first.data.id

      const second = await request(memberJar, '/api/tickets', {
        method: 'POST',
        json: {
          title: `GA Student Second ${suffix}`,
          teamId: memberTeam.id,
          assigneeId: member.id,
          status: 'BACKLOG',
          startDate: '2026-09-10',
          dueDate: '2026-09-12',
        },
      })
      expectStatus(second, 200, 'second student ticket create')
      secondTicketId = second.data.id
      const scheduledCreate = await prisma.ticket.findUniqueOrThrow({ where: { id: secondTicketId } })
      assert.equal(scheduledCreate.startDate?.toISOString().slice(0, 10), '2026-09-10')
      assert.equal(scheduledCreate.dueDate?.toISOString().slice(0, 10), '2026-09-12')

      const third = await request(memberJar, '/api/tickets', {
        method: 'POST',
        json: {
          title: `GA Student Third ${suffix}`,
          teamId: memberTeam.id,
          assigneeId: member.id,
          status: 'BACKLOG',
        },
      })
      expectStatus(third, 200, 'third student ticket create')
      thirdTicketId = third.data.id

      const stored = await prisma.ticket.findMany({
        where: { id: { in: [firstTicketId, secondTicketId, thirdTicketId] } },
        select: { id: true, teamId: true, assigneeId: true, createdById: true, status: true, position: true },
        orderBy: { position: 'asc' },
      })
      assert.equal(stored.length, 3)
      assert.deepEqual(stored.map((ticket) => ticket.position), [1, 2, 3])
      for (const ticket of stored) {
        assert.equal(ticket.teamId, memberTeam.id)
        assert.equal(ticket.assigneeId, member.id)
        assert.equal(ticket.createdById, member.id)
        assert.equal(ticket.status, 'BACKLOG')
      }
    })

    await check('schedule rejects invalid or reversed dates without mutating the ticket', async () => {
      for (const json of [
        { startDate: '2026-09-20', dueDate: '2026-09-10' },
        { startDate: '2026-02-30' },
        { dueDate: 'not-a-date' },
      ]) {
        const bad = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json })
        expectStatus(bad, 400, 'invalid schedule')
      }
      const unchanged = await request(memberJar, `/api/tickets/${firstTicketId}`)
      expectStatus(unchanged, 200, 'unchanged schedule')
      assert.equal(unchanged.data.startDate, null)
      assert.equal(unchanged.data.dueDate, null)
    })

    await check('planned dates persist, validate partial edits, respect permissions, and can be cleared', async () => {
      const scheduled = await request(memberJar, `/api/tickets/${firstTicketId}`, {
        method: 'PATCH', json: { startDate: '2026-09-10', dueDate: '2026-09-10' },
      })
      expectStatus(scheduled, 200, 'same-day schedule')
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: firstTicketId } })
      assert.equal(stored.startDate?.toISOString().slice(0, 10), '2026-09-10')
      assert.equal(stored.dueDate?.toISOString().slice(0, 10), '2026-09-10')
      const badPartial = await request(memberJar, `/api/tickets/${firstTicketId}`, {
        method: 'PATCH', json: { startDate: '2026-09-11' },
      })
      expectStatus(badPartial, 400, 'partial schedule validates existing due date')
      const denied = await request(observerJar, `/api/tickets/${firstTicketId}`, {
        method: 'PATCH', json: { startDate: '2026-09-09' },
      })
      expectStatus(denied, 403, 'observer cannot schedule')
      const untouched = await request(memberJar, `/api/tickets/${firstTicketId}`, {
        method: 'PATCH', json: { description: 'Dates must survive unrelated edits' },
      })
      expectStatus(untouched, 200, 'unrelated edit')
      assert.equal(untouched.data.startDate.slice(0, 10), '2026-09-10')
      const cleared = await request(memberJar, `/api/tickets/${firstTicketId}`, {
        method: 'PATCH', json: { startDate: null, dueDate: null },
      })
      expectStatus(cleared, 200, 'clear dates')
      assert.equal(cleared.data.startDate, null)
      assert.equal(cleared.data.dueDate, null)
    })

    await check('student ticket move persists', async () => {
      const moved = await request(memberJar, `/api/tickets/${firstTicketId}`, {
        method: 'PATCH',
        json: { status: 'DOING' },
      })
      expectStatus(moved, 200, 'student ticket move')
      const stored = await prisma.ticket.findUniqueOrThrow({
        where: { id: firstTicketId },
        select: { status: true, position: true },
      })
      assert.equal(stored.status, 'DOING')
      assert.ok(Number.isInteger(stored.position))
      const history = await prisma.ticketHistory.findFirst({
        where: { ticketId: firstTicketId, action: 'moved' },
        orderBy: { timestamp: 'desc' },
      })
      assert.equal(history?.fromStatus, 'BACKLOG')
      assert.equal(history?.toStatus, 'DOING')
    })

    await check('actual start is automatic, provenance-aware, protected, and stable across reopening', async () => {
      const initial = await request(memberJar, `/api/tickets/${firstTicketId}`)
      expectStatus(initial, 200, 'read first actual start')
      assert.ok(initial.data.startedAt)
      assert.equal(initial.data.startDateAutoFilled, true)
      assert.equal(initial.data.startDate.slice(0, 10), initial.data.startedAt.slice(0, 10))
      for (const status of ['DOING', 'BACKLOG', 'DOING']) {
        const moved = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { status } })
        expectStatus(moved, 200, 'start-preserving transition')
        assert.equal(moved.data.startedAt, initial.data.startedAt)
      }
      for (const json of [{ startedAt: '2000-01-01T00:00:00Z' }, { startDateAutoFilled: false }]) {
        const forged = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json })
        expectStatus(forged, 400, 'actual start is server owned')
      }
      const overdue = await request(memberJar, '/api/tickets', { method: 'POST', json: { title: 'Overdue start fixture', teamId: memberTeam.id, status: 'DOING', dueDate: '2001-01-01' } })
      expectStatus(overdue, 200, 'start overdue work')
      assert.ok(overdue.data.startedAt)
      assert.equal(overdue.data.startDateAutoFilled, true)
      assert.equal(overdue.data.dueDate.slice(0, 10), '2001-01-01')
      const roundtrip = await request(memberJar, `/api/tickets/${overdue.data.id}`, { method: 'PATCH', json: { startDate: overdue.data.startDate.slice(0, 10), dueDate: '2001-01-01', description: 'Unchanged automatic start must permit ordinary editor saves' } })
      expectStatus(roundtrip, 200, 'overdue auto-start editor roundtrip')
      assert.equal(roundtrip.data.startDateAutoFilled, true)
      const planned = await request(memberJar, '/api/tickets', { method: 'POST', json: { title: 'Planned start fixture', teamId: memberTeam.id, status: 'DOING', startDate: '2026-01-01', dueDate: '2026-01-03' } })
      expectStatus(planned, 200, 'start work with genuine plan')
      assert.equal(planned.data.startDateAutoFilled, false)
      assert.equal(planned.data.startDate.slice(0, 10), '2026-01-01')
      assert.ok(planned.data.startedAt)
    })

    await check('completion timestamps follow real status transitions and cannot be forged', async () => {
      const before = Date.now()
      const initialRace = await Promise.all([0, 1].map(() => request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { status: 'DONE' } })))
      for (const result of initialRace) assert.ok([200, 409].includes(result.status))
      const done = initialRace.find(result => result.status === 200)!
      assert.ok(done, 'At least one concurrent completion succeeds')
      assert.ok(done.data.completedAt, 'DONE must automatically record completion')
      const firstCompletion = done.data.completedAt
      for (const result of initialRace.filter(result => result.status === 200)) assert.equal(result.data.completedAt, firstCompletion)
      assert.equal(await prisma.ticketHistory.count({ where: { ticketId: firstTicketId, action: 'moved', toStatus: 'DONE' } }), 1)
      assert.ok(new Date(firstCompletion).getTime() >= before)
      assert.ok(new Date(firstCompletion).getTime() <= Date.now())
      const repeated = await Promise.all([0, 1].map(() => request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { status: 'DONE' } })))
      for (const result of repeated) assert.ok([200, 409].includes(result.status))
      const edited = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { description: 'Completed ticket edit preserves timestamp' } })
      expectStatus(edited, 200, 'edit completed ticket')
      assert.equal(edited.data.completedAt, firstCompletion)
      const forged = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { completedAt: '2000-01-01T00:00:00Z' } })
      expectStatus(forged, 400, 'client cannot forge completion')
      const reopened = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { status: 'DOING' } })
      expectStatus(reopened, 200, 'reopen ticket')
      assert.equal(reopened.data.completedAt, null)
      const history = await prisma.ticketHistory.findMany({ where: { ticketId: firstTicketId, action: 'moved', fromStatus: 'DONE', toStatus: 'DOING' }, orderBy: { timestamp: 'desc' } })
      assert.equal(JSON.parse(history[0].details || '{}').previousCompletedAt, firstCompletion)
      const recompleted = await request(memberJar, `/api/tickets/${firstTicketId}`, { method: 'PATCH', json: { status: 'DONE' } })
      expectStatus(recompleted, 200, 'recomplete ticket')
      assert.ok(new Date(recompleted.data.completedAt).getTime() >= new Date(firstCompletion).getTime())
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: firstTicketId } })
      assert.equal(stored.completedAt?.toISOString(), recompleted.data.completedAt)
    })

    await check('direct DONE creation timestamps completion and legacy DONE edits do not invent dates', async () => {
      const created = await request(memberJar, '/api/tickets', { method: 'POST', json: { title: `Direct completion ${suffix}`, teamId: memberTeam.id, status: 'DONE' } })
      expectStatus(created, 200, 'direct DONE creation')
      assert.ok(created.data.completedAt)
      const legacy = await prisma.ticket.create({ data: { title: 'Legacy done fixture', status: 'DONE', teamId: memberTeam.id, createdById: member.id } })
      const edit = await request(memberJar, `/api/tickets/${legacy.id}`, { method: 'PATCH', json: { status: 'DONE', description: 'Unknown historical completion stays unknown' } })
      expectStatus(edit, 200, 'legacy DONE edit')
      assert.equal(edit.data.completedAt, null)
      const backlog = await request(memberJar, `/api/tickets/${legacy.id}`, { method: 'PATCH', json: { status: 'BACKLOG' } })
      expectStatus(backlog, 200, 'reopen to backlog')
      const direct = await request(memberJar, `/api/tickets/${legacy.id}`, { method: 'PATCH', json: { status: 'DONE' } })
      expectStatus(direct, 200, 'backlog to DONE')
      assert.ok(direct.data.completedAt)
    })

    await check('student ticket reorder persists and reads back in order', async () => {
      const reordered = await request(memberJar, `/api/tickets/${secondTicketId}/reorder`, {
        method: 'PATCH',
        json: { targetTicketId: thirdTicketId },
      })
      expectStatus(reordered, 200, 'student ticket reorder')
      assert.deepEqual(
        reordered.data.positions,
        [
          { id: thirdTicketId, position: 1 },
          { id: secondTicketId, position: 2 },
        ]
      )
      const stored = await prisma.ticket.findMany({
        where: { id: { in: [secondTicketId, thirdTicketId] } },
        select: { id: true, status: true, position: true },
        orderBy: { position: 'asc' },
      })
      assert.deepEqual(stored, [
        { id: thirdTicketId, status: 'BACKLOG', position: 1 },
        { id: secondTicketId, status: 'BACKLOG', position: 2 },
      ])

      const readBack = await request(
        memberJar,
        `/api/tickets?teamId=${encodeURIComponent(memberTeam.id)}&status=BACKLOG`
      )
      expectStatus(readBack, 200, 'ticket reorder read-back')
      assert.deepEqual(
        readBack.data.map((ticket: { id: string }) => ticket.id),
        [thirdTicketId, secondTicketId]
      )
    })

    let otherTicketId = ''
    await check('student cross-team create and update denied', async () => {
      const otherCreate = await request(otherJar, '/api/tickets', {
        method: 'POST',
        json: {
          title: `GA Other Team Ticket ${suffix}`,
          teamId: otherTeam.id,
          assigneeId: other.id,
          status: 'BACKLOG',
        },
      })
      expectStatus(otherCreate, 200, 'other student ticket create')
      otherTicketId = otherCreate.data.id

      const deniedCreate = await request(memberJar, '/api/tickets', {
        method: 'POST',
        json: { title: `Forbidden Cross Team ${suffix}`, teamId: otherTeam.id },
      })
      expectStatus(deniedCreate, 403, 'cross-team ticket create')

      const deniedUpdate = await request(memberJar, `/api/tickets/${otherTicketId}`, {
        method: 'PATCH',
        json: { title: `Forbidden Update ${suffix}`, position: 99 },
      })
      expectStatus(deniedUpdate, 403, 'cross-team ticket update')
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: otherTicketId } })
      assert.equal(stored.title, `GA Other Team Ticket ${suffix}`)
      assert.equal(stored.position, 1)
      assert.equal(
        await prisma.ticket.count({ where: { title: `Forbidden Cross Team ${suffix}` } }),
        0
      )
    })

    await check('observer ticket create and update denied', async () => {
      const deniedCreate = await request(observerJar, '/api/tickets', {
        method: 'POST',
        json: { title: `Forbidden Observer Ticket ${suffix}`, teamId: memberTeam.id },
      })
      expectStatus(deniedCreate, 403, 'observer ticket create')

      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: secondTicketId } })
      const deniedUpdate = await request(observerJar, `/api/tickets/${secondTicketId}`, {
        method: 'PATCH',
        json: { title: `Forbidden Observer Update ${suffix}`, position: 101 },
      })
      expectStatus(deniedUpdate, 403, 'observer ticket update')
      const deniedReorder = await request(observerJar, `/api/tickets/${secondTicketId}/reorder`, {
        method: 'PATCH',
        json: { targetTicketId: thirdTicketId },
      })
      expectStatus(deniedReorder, 403, 'observer ticket reorder')

      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: secondTicketId } })
      assert.equal(after.title, before.title)
      assert.equal(after.position, before.position)
      assert.equal(
        await prisma.ticket.count({ where: { title: `Forbidden Observer Ticket ${suffix}` } }),
        0
      )
    })

    await check('admin hard-deletes an archived ticket while non-admin remains denied', async () => {
      const created = await request(adminJar, '/api/tickets', {
        method: 'POST',
        json: { title: `GA Hard Delete ${suffix}`, teamId: memberTeam.id },
      })
      expectStatus(created, 200, 'hard-delete fixture create')
      const ticketId = created.data.id as string

      const archived = await request(adminJar, `/api/tickets/${ticketId}`, { method: 'DELETE' })
      expectStatus(archived, 200, 'hard-delete fixture archive')
      assert.equal(archived.data.deleted, 'archived')

      const denied = await request(memberJar, `/api/tickets/${ticketId}?hard=true`, { method: 'DELETE' })
      expectStatus(denied, 403, 'member archived ticket hard delete')
      assert.equal(await prisma.ticket.count({ where: { id: ticketId } }), 1)

      const removed = await request(adminJar, `/api/tickets/${ticketId}?hard=true`, { method: 'DELETE' })
      expectStatus(removed, 200, 'admin archived ticket hard delete')
      assert.deepEqual(removed.data, { success: true, deleted: 'hard' })
      assert.equal(await prisma.ticket.count({ where: { id: ticketId } }), 0)
    })

    let resources = [
      { key: 'NETWORK_MAP', url: `http://127.0.0.1/ga/network-map/${suffix}` },
      { key: 'PROJECT_TUTORIAL', url: `https://example.invalid/ga/tutorial/${suffix}` },
    ]
    await check('class resources admin write persists and member reads back', async () => {
      const write = await request(adminJar, `/api/classes/${workspace.id}/resources`, {
        method: 'PUT',
        json: { resources, expectedResources: [] },
      })
      expectStatus(write, 200, 'admin resource write')

      const stored = await prisma.classResource.findMany({
        where: { classWorkspaceId: workspace.id },
        select: { key: true, url: true },
        orderBy: { key: 'asc' },
      })
      assert.deepEqual(stored, [...resources].sort((a, b) => a.key.localeCompare(b.key)))

      const readBack = await request(memberJar, `/api/classes/${workspace.id}/resources`)
      expectStatus(readBack, 200, 'member resource read-back')
      assert.deepEqual(readBack.data, resources)
    })

    await check('stale admin resource replacement conflicts without losing the winning edit', async () => {
      const staleBaseline = resources
      const winningResources = [
        ...resources,
        { key: 'RED_HAT', url: `https://example.invalid/ga/redhat/${suffix}` },
      ]
      const winner = await request(adminJar, `/api/classes/${workspace.id}/resources`, {
        method: 'PUT',
        json: { resources: winningResources, expectedResources: staleBaseline },
      })
      expectStatus(winner, 200, 'winning admin resource write')

      const stale = await request(adminJar, `/api/classes/${workspace.id}/resources`, {
        method: 'PUT',
        json: {
          resources: [{ key: 'EXTRAS', url: `https://example.invalid/ga/stale/${suffix}` }],
          expectedResources: staleBaseline,
        },
      })
      expectStatus(stale, 409, 'stale admin resource write')

      const stored = await prisma.classResource.findMany({
        where: { classWorkspaceId: workspace.id },
        select: { key: true, url: true },
        orderBy: { key: 'asc' },
      })
      assert.deepEqual(stored, [...winningResources].sort((a, b) => a.key.localeCompare(b.key)))
      resources = winningResources
    })

    await check('class resources member write denied without mutation', async () => {
      const denied = await request(memberJar, `/api/classes/${workspace.id}/resources`, {
        method: 'PUT',
        json: {
          resources: [{ key: 'LAB_LINK', url: `https://example.invalid/forbidden/${suffix}` }],
          expectedResources: resources,
        },
      })
      expectStatus(denied, 403, 'member resource write')
      const stored = await prisma.classResource.findMany({
        where: { classWorkspaceId: workspace.id },
        select: { key: true, url: true },
        orderBy: { key: 'asc' },
      })
      assert.deepEqual(stored, [...resources].sort((a, b) => a.key.localeCompare(b.key)))
    })

    const noteContent = `GA collaborative note ${suffix}`
    await check('team note member write persists', async () => {
      const write = await request(memberJar, `/api/teams/${memberTeam.id}/note`, {
        method: 'PUT',
        json: { content: noteContent, revision: 0 },
      })
      expectStatus(write, 200, 'member note write')
      assert.equal(write.data.content, noteContent)
      assert.equal(write.data.revision, 1)
      const stored = await prisma.teamNote.findUniqueOrThrow({ where: { teamId: memberTeam.id } })
      assert.equal(stored.content, noteContent)
      assert.equal(stored.revision, 1)
    })

    await check('team note observer write denied', async () => {
      const denied = await request(observerJar, `/api/teams/${memberTeam.id}/note`, {
        method: 'PUT',
        json: { content: `Forbidden observer note ${suffix}`, revision: 1 },
      })
      expectStatus(denied, 403, 'observer note write')
      const stored = await prisma.teamNote.findUniqueOrThrow({ where: { teamId: memberTeam.id } })
      assert.equal(stored.content, noteContent)
      assert.equal(stored.revision, 1)
    })

    await check('team note stale revision conflicts and current note reads back', async () => {
      const conflict = await request(memberJar, `/api/teams/${memberTeam.id}/note`, {
        method: 'PUT',
        json: { content: `Stale note ${suffix}`, revision: 0 },
      })
      expectStatus(conflict, 409, 'stale note write')

      const readBack = await request(memberJar, `/api/teams/${memberTeam.id}/note`)
      expectStatus(readBack, 200, 'member note read-back')
      assert.equal(readBack.data.content, noteContent)
      assert.equal(readBack.data.revision, 1)
      const stored = await prisma.teamNote.findUniqueOrThrow({ where: { teamId: memberTeam.id } })
      assert.equal(stored.content, noteContent)
      assert.equal(stored.revision, 1)
    })

    const deliverables = [
      {
        title: `GA Required Deliverable ${suffix}`,
        description: `Required details ${suffix}`,
        kind: 'required',
      },
      {
        title: `GA Bonus Deliverable ${suffix}`,
        description: `Bonus details ${suffix}`,
        kind: 'bonus',
      },
    ]
    await check('deliverables distribute to every team with exact tags and counts', async () => {
      const distribute = await request(adminJar, `/api/classes/${workspace.id}/deliverables`, {
        method: 'POST',
        json: { deliverables },
      })
      await recordNewWorkflowTags(workflowTagIdsBefore)
      expectStatus(distribute, 200, 'deliverables distribution')
      assert.deepEqual(distribute.data, { created: 4, skipped: 0, teams: 2, deliverables: 2 })

      const stored = await prisma.ticket.findMany({
        where: {
          teamId: { in: [memberTeam.id, otherTeam.id] },
          title: { in: deliverables.map(({ title }) => title) },
        },
        select: {
          teamId: true,
          title: true,
          description: true,
          status: true,
          createdById: true,
          tags: { select: { tag: { select: { id: true, name: true, teamId: true } } } },
        },
        orderBy: [{ teamId: 'asc' }, { title: 'asc' }],
      })
      assert.equal(stored.length, 4)
      for (const teamId of [memberTeam.id, otherTeam.id]) {
        const teamTickets = stored.filter((ticket) => ticket.teamId === teamId)
        assert.equal(teamTickets.length, 2)
        for (const deliverable of deliverables) {
          const ticket = teamTickets.find((candidate) => candidate.title === deliverable.title)
          assert.ok(ticket)
          assert.equal(ticket.description, deliverable.description)
          assert.equal(ticket.status, 'BACKLOG')
          assert.equal(ticket.createdById, admin.id)
          assert.equal(ticket.tags.length, 1)
          assert.equal(ticket.tags[0].tag.name, deliverable.kind === 'required' ? 'Required' : 'Bonus / Extra')
          assert.equal(ticket.tags[0].tag.teamId, null)
        }
      }
      assert.equal(
        await prisma.ticketHistory.count({
          where: {
            ticket: {
              teamId: { in: [memberTeam.id, otherTeam.id] },
              title: { in: deliverables.map(({ title }) => title) },
            },
            action: 'created',
            userId: admin.id,
          },
        }),
        4
      )
    })

    await check('deliverables distribution is idempotent', async () => {
      const repeat = await request(adminJar, `/api/classes/${workspace.id}/deliverables`, {
        method: 'POST',
        json: { deliverables },
      })
      expectStatus(repeat, 200, 'repeat deliverables distribution')
      assert.deepEqual(repeat.data, { created: 0, skipped: 4, teams: 2, deliverables: 2 })
      assert.equal(
        await prisma.ticket.count({
          where: {
            teamId: { in: [memberTeam.id, otherTeam.id] },
            title: { in: deliverables.map(({ title }) => title) },
          },
        }),
        4
      )
      const workflowTags = await prisma.tag.findMany({
        where: { teamId: null, name: { in: ['Required', 'Bonus / Extra'] } },
        select: { id: true, name: true },
      })
      assert.equal(new Set(workflowTags.map(({ name }) => name)).size, 2)
      assert.equal(workflowTags.length, 2)
      fixture.newlyCreatedWorkflowTagIds = workflowTags
        .filter(({ id }) => !workflowTagIdsBefore.has(id))
        .map(({ id }) => id)
    })

    let feedbackId = ''
    await check('private instructor feedback preserves staff posts with replies, acknowledgments and unread state', async () => {
      const path = `/api/teams/${memberTeam.id}/feedback`
      const body = `Please document testing and verification ${suffix}`
      const posted = await request(adminJar, path, { method: 'POST', json: { body, category: 'ACTION_REQUIRED', ticketId: firstTicketId, pinned: true } })
      assert.ok([200, 201].includes(posted.status), 'Admin feedback create must succeed')
      const feed = await request(memberJar, path)
      expectStatus(feed, 200, 'member reads own feedback')
      const post = feed.data.posts.find((item: any) => item.body === body)
      assert.ok(post); feedbackId = post.id
      assert.equal(post.category, 'ACTION_REQUIRED'); assert.equal(post.pinned, true)
      assert.equal(post.ticket.id, firstTicketId); assert.equal(post.isUnread, true)
      expectStatus(await request(otherJar, path), 403, 'other team cannot read feedback')
      expectStatus(await request(observerJar, path), 403, 'observer cannot read feedback')
      expectStatus(await request(memberJar, path, { method: 'POST', json: { body: 'Student cannot impersonate instructor', category: 'GUIDANCE' } }), 403, 'student cannot post instructor feedback')
      const reply = await request(memberJar, `${path}/${feedbackId}/replies`, { method: 'POST', json: { body: 'We will add the verification results.' } })
      assert.ok([200, 201].includes(reply.status))
      for (let repeat = 0; repeat < 2; repeat++) {
        const ack = await request(memberJar, `${path}/${feedbackId}/acknowledge`, { method: 'POST', json: {} })
        assert.ok([200, 201].includes(ack.status))
      }
      const seen = await request(memberJar, `${path}/read`, { method: 'POST', json: { throughId: feedbackId } })
      expectStatus(seen, 200, 'mark feedback read')
      const refreshed = await request(memberJar, path)
      const unchanged = refreshed.data.posts.find((item: any) => item.id === feedbackId)
      assert.equal(unchanged.body, body)
      assert.equal(unchanged.replies.length, 1)
      assert.equal(unchanged.acknowledgments.filter((a: any) => a.userId === member.id).length, 1)
      assert.equal(unchanged.acknowledgedByMe, true)
      assert.equal(unchanged.isUnread, false)
      expectStatus(await request(memberJar, `${path}/${feedbackId}`, { method: 'PATCH', json: { pinned: false } }), 403, 'member cannot modify instructor pin')
      await prisma.user.update({ where: { id: member.id }, data: { role: 'TEAM_LEAD' } })
      expectStatus(await request(memberJar, path, { method: 'POST', json: { body: 'Student lead is not instructional staff', category: 'GUIDANCE' } }), 403, 'student lead cannot post as staff')
      await prisma.user.update({ where: { id: member.id }, data: { role: 'MEMBER' } })
    })

    await check('nightly settings are admin-only, opt-in and queue review requests', async () => {
      const path = `/api/classes/${workspace.id}/nightly-review`
      const initial = await request(adminJar, path)
      expectStatus(initial, 200, 'admin reads nightly settings')
      assert.equal(initial.data.nightlyReviewEnabled, false)
      expectStatus(await request(memberJar, path), 403, 'member cannot read admin scheduler settings')
      expectStatus(await request(memberJar, path, { method: 'PATCH', json: { enabled: true, hour: 2, timeZone: 'America/Los_Angeles' } }), 403, 'member cannot enable automatic inference')
      const enabled = await request(adminJar, path, { method: 'PATCH', json: { enabled: true, hour: 2, timeZone: 'America/Los_Angeles' } })
      expectStatus(enabled, 200, 'enable local fixture reviews')
      const queued = await request(adminJar, `${path}/run`, { method: 'POST', json: {} })
      assert.ok([200, 202].includes(queued.status))
      const guidancePath = `/api/tickets/${firstTicketId}/guidance`
      expectStatus(await request(memberJar, guidancePath), 200, 'member reads saved guidance')
      expectStatus(await request(otherJar, guidancePath), 403, 'other team cannot read saved guidance')
      expectStatus(await request(observerJar, guidancePath), 403, 'observer cannot read saved guidance')
    })

    await check('archived class blocks ticket resource note and deliverable writes', async () => {
      const archive = await request(adminJar, `/api/classes/${workspace.id}`, {
        method: 'PATCH',
        json: { action: 'archive' },
      })
      expectStatus(archive, 200, 'class archive')
      const archived = await prisma.classWorkspace.findUniqueOrThrow({ where: { id: workspace.id } })
      assert.ok(archived.archivedAt)
      expectStatus(await request(adminJar, `/api/teams/${memberTeam.id}/feedback`, { method: 'POST', json: { body: 'Archived feedback blocked', category: 'GUIDANCE' } }), 409, 'archived instructor posting')
      expectStatus(await request(memberJar, `/api/teams/${memberTeam.id}/feedback/${feedbackId}/replies`, { method: 'POST', json: { body: 'Archived reply blocked' } }), 409, 'archived feedback reply')
      expectStatus(await request(adminJar, `/api/classes/${workspace.id}/nightly-review/run`, { method: 'POST', json: {} }), 409, 'archived nightly request')
      expectStatus(await request(memberJar, `/api/teams/${memberTeam.id}/feedback`), 200, 'archived private feedback remains readable')

      const ticketBefore = await prisma.ticket.findUniqueOrThrow({ where: { id: secondTicketId } })
      const noteBefore = await prisma.teamNote.findUniqueOrThrow({ where: { teamId: memberTeam.id } })
      const resourcesBefore = await prisma.classResource.findMany({
        where: { classWorkspaceId: workspace.id },
        select: { key: true, url: true },
        orderBy: { key: 'asc' },
      })
      const deliverableCountBefore = await prisma.ticket.count({
        where: {
          teamId: { in: [memberTeam.id, otherTeam.id] },
          title: { in: deliverables.map(({ title }) => title) },
        },
      })

      const blockedCreate = await request(memberJar, '/api/tickets', {
        method: 'POST',
        json: { title: `Archived create ${suffix}`, teamId: memberTeam.id },
      })
      expectStatus(blockedCreate, 409, 'archived ticket create')

      const blockedUpdate = await request(memberJar, `/api/tickets/${secondTicketId}`, {
        method: 'PATCH',
        json: { title: `Archived update ${suffix}`, position: 500 },
      })
      expectStatus(blockedUpdate, 409, 'archived ticket update')

      const blockedReorder = await request(memberJar, `/api/tickets/${secondTicketId}/reorder`, {
        method: 'PATCH',
        json: { targetTicketId: thirdTicketId },
      })
      expectStatus(blockedReorder, 409, 'archived ticket reorder')

      const blockedResources = await request(adminJar, `/api/classes/${workspace.id}/resources`, {
        method: 'PUT',
        json: {
          resources: [{ key: 'EXTRAS', url: `https://example.invalid/archived/${suffix}` }],
          expectedResources: resources,
        },
      })
      expectStatus(blockedResources, 409, 'archived resource write')

      const blockedNote = await request(memberJar, `/api/teams/${memberTeam.id}/note`, {
        method: 'PUT',
        json: { content: `Archived note ${suffix}`, revision: noteBefore.revision },
      })
      expectStatus(blockedNote, 409, 'archived note write')

      const blockedDeliverables = await request(adminJar, `/api/classes/${workspace.id}/deliverables`, {
        method: 'POST',
        json: {
          deliverables: [
            { title: `Archived Deliverable ${suffix}`, description: null, kind: 'required' },
          ],
        },
      })
      expectStatus(blockedDeliverables, 409, 'archived deliverables write')

      const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: secondTicketId } })
      assert.equal(ticketAfter.title, ticketBefore.title)
      assert.equal(ticketAfter.position, ticketBefore.position)
      assert.equal(await prisma.ticket.count({ where: { title: `Archived create ${suffix}` } }), 0)
      assert.equal(await prisma.ticket.count({ where: { title: `Archived Deliverable ${suffix}` } }), 0)
      const noteAfter = await prisma.teamNote.findUniqueOrThrow({ where: { teamId: memberTeam.id } })
      assert.equal(noteAfter.content, noteBefore.content)
      assert.equal(noteAfter.revision, noteBefore.revision)
      const resourcesAfter = await prisma.classResource.findMany({
        where: { classWorkspaceId: workspace.id },
        select: { key: true, url: true },
        orderBy: { key: 'asc' },
      })
      assert.deepEqual(resourcesAfter, resourcesBefore)
      assert.equal(
        await prisma.ticket.count({
          where: {
            teamId: { in: [memberTeam.id, otherTeam.id] },
            title: { in: deliverables.map(({ title }) => title) },
          },
        }),
        deliverableCountBefore
      )
    })
  } catch (error) {
    failure = error
  } finally {
    try {
      await cleanup()
    } catch (cleanupError) {
      if (!failure) failure = cleanupError
      else console.error('Cleanup also failed')
    } finally {
      await prisma.$disconnect()
    }
  }

  if (failure) throw failure
  console.log(`PASS total ${passCount}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`FAIL ga-integration-check: ${message}`)
  process.exitCode = 1
})
