// Optional browser QA dependency is loaded outside the app's runtime bundle.
// Run only against the disposable local QA database and loopback app.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const base = process.env.GA_BASE_URL
const db = new URL(process.env.DATABASE_URL || 'file:///missing')
assert.equal(base, 'http://127.0.0.1:3459', 'Local QA app required')
assert.equal(db.hostname, '127.0.0.1', 'Local QA database required')
assert.equal(db.port, '55439')
assert.equal(db.pathname, '/sanctum_ga_check')
assert.ok(['postgres:', 'postgresql:'].includes(db.protocol))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const prisma = new PrismaClient()
const browser = await chromium.launch({ headless: true })
const suffix = randomUUID()
const password = randomBytes(24).toString('base64url')
const passwordHash = await bcrypt.hash(password, 10)
const users = []
const classes = []
const errors = []
const output = process.env.GANTT_QA_OUTPUT || '/tmp/sanctum-ga-check/gantt-browser'
await mkdir(output, { recursive: true })
const now = new Date()
const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
function day(offset) { const d = new Date(today); d.setUTCDate(d.getUTCDate() + offset); return d }
function key(date) { return date.toISOString().slice(0, 10) }
let checks = 0
let completed = false
function pass(name) { checks++; console.log(`PASS ${name}`) }

async function openAs(user, archived = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + '/login')
  if (user) {
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Observe without signing in' }).click()
  }
  await page.waitForURL(url => url.pathname === '/')
  await page.goto(base + '/?classId=' + classes[0] + (archived ? '&archived=1' : ''))
  await page.getByRole('button', { name: 'Gantt', exact: true }).click()
  await page.getByRole('region', { name: 'Gantt chart', exact: true }).waitFor()
  return { page, context }
}

try {
  for (const [firstName, role, color] of [['Instructor', 'ADMIN', '#2563eb'], ['Avery', 'MEMBER', '#10b981'], ['Blake', 'MEMBER', '#f59e0b']]) {
    users.push(await prisma.user.create({ data: { email: `gantt-${firstName}-${suffix}@example.invalid`, firstName, lastName: 'QA', role, color, passwordHash } }))
  }
  const workspace = await prisma.classWorkspace.create({ data: { name: `Gantt local QA ${suffix}`, createdById: users[0].id, members: { create: users.map(u => ({ userId: u.id })) } } })
  classes.push(workspace.id)
  const hidden = await prisma.classWorkspace.create({ data: { name: `Hidden QA ${suffix}`, createdById: users[0].id } })
  classes.push(hidden.id)
  const alpha = await prisma.team.create({ data: { name: 'Alpha QA', classWorkspaceId: workspace.id, members: { create: { userId: users[1].id } } } })
  const bravo = await prisma.team.create({ data: { name: 'Bravo QA', classWorkspaceId: workspace.id, members: { create: { userId: users[2].id } } } })
  await prisma.team.create({ data: { name: 'Empty QA', classWorkspaceId: workspace.id } })
  await prisma.team.create({ data: { name: 'Hidden other-class team', classWorkspaceId: hidden.id } })
  const fixtures = [
    ['Network inventory', alpha, users[1], -3, 3, 'DOING'],
    ['Firewall rules', alpha, users[1], -3, -1, 'BACKLOG'],
    ['Lab validation', alpha, users[1], 0, 0, 'BACKLOG'],
    ['Unscheduled research', alpha, users[1], null, null, 'BACKLOG'],
    ['Deadline only', alpha, users[1], null, 5, 'BACKLOG'],
    ['Next semester work', alpha, users[1], 120, 130, 'BACKLOG'],
    ['Completed lab', alpha, users[1], -4, -1, 'DONE'],
    ['Peer team plan', bravo, users[2], 0, 5, 'DOING'],
    ['Finished late', alpha, users[1], -8, -3, 'DONE', 0],
    ['Finished early', alpha, users[1], -5, 2, 'DONE', 0],
    ['Finished on time', alpha, users[1], -3, 0, 'DONE', 0],
    ['Prior period finish', alpha, users[1], -60, -45, 'DONE', 0],
  ]
  const tickets = []
  for (const [title, team, owner, start, due, status, completed] of fixtures) {
    tickets.push(await prisma.ticket.create({ data: { title, description: 'Disposable local Gantt QA ticket; any prefilled completion is synthetic test data.', teamId: team.id, createdById: owner.id, assigneeId: owner.id, startDate: start === null ? null : day(start), dueDate: due === null ? null : day(due), completedAt: completed === undefined ? null : day(completed), status, position: tickets.length } }))
  }
  const { page, context } = await openAs(users[1])
  const chart = page.getByRole('region', { name: 'Gantt chart', exact: true })
  assert.equal(await chart.getByText('Hidden other-class team').count(), 0)
  await chart.getByRole('button', { name: /Open Network inventory/ }).first().waitFor()
  assert.equal(await chart.getByRole('button', { name: /Open Unscheduled research/ }).count(), 1)
  assert.equal(await chart.getByRole('button', { name: /Open Deadline only/ }).count(), 1)
  assert.equal(await chart.getByRole('button', { name: /Open Next semester work/ }).count(), 0)
  assert.ok(await chart.getByText(/outside this date range/).count())
  pass('class-scoped team rows, scheduled and unscheduled tickets, outside-window classification')
  for (const label of ['3 days late', '2 days early', 'Completed on time', 'Completion date not recorded', 'Overdue—not completed']) {
    assert.ok(await chart.getByText(label, { exact: true }).count(), `Missing completion label: ${label}`)
  }
  await chart.getByRole('button', { name: /Open Prior period finish/ }).first().waitFor()
  assert.ok(await chart.getByTestId('gantt-early-remainder').count(), 'Early completion must visibly fade the remaining planned span')
  pass('early, late, on-time, legacy and overdue indicators, including actual-only date window')
  await page.getByLabel('Team', { exact: true }).selectOption(bravo.id)
  assert.equal(await chart.getByRole('button', { name: /Open Network inventory/ }).count(), 0)
  await chart.getByRole('button', { name: /Open Peer team plan/ }).first().click()
  await page.getByText('Read-only ticket details for Bravo QA.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Save Changes' }).count(), 0)
  await page.keyboard.press('Escape')
  pass('team filter and non-owned team read-only details')
  await page.getByLabel('Team', { exact: true }).selectOption(alpha.id)
  await chart.getByRole('button', { name: /Open Network inventory/ }).first().click()
  await page.getByRole('heading', { name: 'Edit Ticket' }).waitFor()
  const start = page.locator('#edit-start-date')
  const due = page.locator('#edit-due-date')
  await start.fill(key(day(1)))
  await due.fill(key(day(4)))
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await page.getByRole('heading', { name: 'Edit Ticket' }).waitFor({ state: 'hidden' })
  await page.reload()
  await page.getByRole('button', { name: 'Gantt', exact: true }).click()
  const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } })
  assert.equal(key(stored.startDate), key(day(1)))
  assert.equal(key(stored.dueDate), key(day(4)))
  pass('member opens existing editor and planned dates persist after browser reload')
  await page.getByRole('button', { name: 'Detailed', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Network inventory', exact: true }).click()
  await page.getByRole('dialog').getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await page.getByRole('heading', { name: 'Edit Ticket' }).waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Gantt', exact: true }).click()
  await chart.getByRole('button', { name: /^Open Network inventory, Done,/ }).waitFor()
  const finished = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } })
  assert.ok(finished.completedAt)
  assert.equal(key(finished.startDate), key(stored.startDate))
  assert.equal(key(finished.dueDate), key(stored.dueDate))
  await chart.getByRole('button', { name: /^Open Network inventory, Done,/ }).click()
  await page.locator(`time[datetime="${finished.completedAt.toISOString()}"]`).waitFor()
  await page.getByRole('dialog').getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Doing', exact: true }).click()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await page.getByRole('heading', { name: 'Edit Ticket' }).waitFor({ state: 'hidden' })
  const reopened = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } })
  assert.equal(reopened.completedAt, null)
  pass('Kanban completion automatically stamps date, Gantt refreshes, and reopening clears it without changing plans')
  await page.getByLabel('Calendar window').selectOption('week')
  await page.getByRole('button', { name: 'Next week', exact: true }).click()
  await page.getByRole('button', { name: 'Previous week', exact: true }).click()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByLabel('Calendar window').selectOption('month')
  const alphaHeader = page.getByRole('button', { name: /^Alpha QA/ })
  await alphaHeader.click()
  assert.equal(await alphaHeader.getAttribute('aria-expanded'), 'false')
  await alphaHeader.click()
  pass('week/month navigation, Today, collapse and expand')
  const region = page.getByTestId('gantt-scroll-region')
  const todayCell = chart.locator('[aria-label$=", today"]')
  const regionBox = await region.boundingBox()
  const todayBox = await todayCell.boundingBox()
  assert.ok(todayBox.x >= regionBox.x && todayBox.x + todayBox.width <= regionBox.x + regionBox.width, 'Today must be visible without manually searching the horizontal scroll')
  await page.screenshot({ path: output + '/gantt-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  assert.ok(widths.document <= widths.viewport + 2, `Page overflow: ${JSON.stringify(widths)}`)
  await page.screenshot({ path: output + '/gantt-mobile.png', fullPage: true })
  pass('mobile page contains horizontal scrolling within the chart')
  await context.close()
  const guest = await openAs(null)
  await guest.page.getByRole('button', { name: /Open Lab validation/ }).first().click()
  await guest.page.getByText('Read-only ticket details for Alpha QA.').waitFor()
  assert.equal(await guest.page.getByRole('button', { name: 'Save Changes' }).count(), 0)
  pass('observer reads scheduled ticket without edit controls')
  await guest.context.close()
  await prisma.classWorkspace.update({ where: { id: workspace.id }, data: { archivedAt: new Date() } })
  const admin = await openAs(users[0], true)
  await admin.page.getByRole('button', { name: /Open Lab validation/ }).first().click()
  await admin.page.getByText('Read-only ticket details for Alpha QA.').waitFor()
  assert.equal(await admin.page.getByRole('button', { name: 'Save Changes' }).count(), 0)
  pass('archived Gantt is read-only even for admins')
  await admin.context.close()
  assert.deepEqual(errors, [], 'Browser JavaScript errors')
  pass('no browser JavaScript exceptions')
  await prisma.classWorkspace.update({ where: { id: workspace.id }, data: { archivedAt: null } })
  completed = true
  console.log(`PASS total ${checks}; screenshots: ${output}`)
} finally {
  await browser.close()
  if (completed && process.env.GANTT_KEEP_FIXTURE === '1') {
    console.log(`Local demo retained for guest preview: ${base}/?classId=${classes[0]}`)
  } else {
    await prisma.classWorkspace.deleteMany({ where: { id: { in: classes } } })
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } })
  }
  await prisma.$disconnect()
}
