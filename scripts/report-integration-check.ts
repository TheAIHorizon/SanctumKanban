// Synthetic fixtures only; never run against a deployed database.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { mkdir } from 'node:fs/promises'
const base = process.env.GA_BASE_URL
const dbUrl = new URL(process.env.DATABASE_URL || 'file:///missing')
assert.equal(base, 'http://127.0.0.1:3459'); assert.equal(dbUrl.hostname, '127.0.0.1'); assert.equal(dbUrl.port, '55439'); assert.equal(dbUrl.pathname, '/sanctum_ga_check')
async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const browser = await chromium.launch({ headless: true }), db = new PrismaClient()
  const users: any[] = [], roles: any[] = [], tasks: any[] = []
  let course: any
  const suffix = randomUUID(), password = randomBytes(24).toString('hex'), passwordHash = await bcrypt.hash(password, 10)
  async function login(user: any) {
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } })
    const csrf = await (await context.request.get('/api/auth/csrf')).json()
    await context.request.post(user.role === 'OBSERVER' ? '/api/auth/callback/observer' : '/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: base, json: 'true' } })
    assert.equal((await (await context.request.get('/api/auth/session')).json()).user.role, user.role)
    return context
  }
  try {
    for (const role of ['ADMIN', 'MEMBER', 'MEMBER', 'OBSERVER']) users.push(await db.user.create({ data: { firstName: role, lastName: 'Report QA', email: `report-${users.length}-${suffix}@example.invalid`, passwordHash, role: role as any } }))
    course = await db.classWorkspace.create({ data: { name: `Report QA ${suffix}`, createdById: users[0].id } })
    const team = await db.team.create({ data: { name: 'Fictional reporting team', classWorkspaceId: course.id, members: { create: { userId: users[1].id } } } })
    for (const [i, title] of Array.from(['System Administrator QA', 'Cyber Defense Analyst QA', 'Policy Specialist QA'].entries())) roles.push(await db.dcwfWorkRole.create({ data: { code: `report-${suffix}-${i}`, title, inScope: i < 2 } }))
    const descriptions = ['Configure servers.', 'Monitor network traffic.', 'Review policy compliance.']
    for (let i = 0; i < 3; i++) {
      const task = await db.dcwfKsat.create({ data: { ksatId: `report-${suffix}-${i}A`, type: 'Task', description: descriptions[i] } }); tasks.push(task)
      for (const role of i === 0 ? [roles[0]] : i === 1 ? roles.slice(0, 2) : [roles[2]]) await db.dcwfRoleKsat.create({ data: { workRoleId: role.id, ksatId: task.id, coreOrAdditional: 'Core' } })
    }
    for (const [index, status] of Array.from(['DONE', 'DOING', 'BACKLOG', 'DONE'].entries())) {
      const task = tasks[index % 3]
      await db.ticket.create({ data: { title: `Report task ${index} <script>bad()</script>`, teamId: team.id, assigneeId: users[1].id, createdById: users[0].id, status: status as any, dcwfTasks: { create: { ksatId: task.id, createdById: index === 1 ? users[1].id : users[0].id, note: index === 2 ? null : 'Verified <img src=x onerror=bad()> configuration.' } } } })
    }
    const admin = await login(users[0]), student = await login(users[1]), outsider = await login(users[2]), observer = await login(users[3])
    const endpoint = `/api/users/${users[1].id}/report`
    for (const context of [outsider, observer]) {
      assert.equal((await context.request.get(endpoint)).status(), 403)
      assert.equal((await context.request.get(endpoint + '/export')).status(), 403)
    }
    const json = await (await student.request.get(endpoint + '?inScopeOnly=true')).json()
    assert.deepEqual(json.workRoleReport.roles.map((r: any) => [r.title, r.taskCount, r.completedTaskCount]), [['System Administrator QA', 2, 1], ['Cyber Defense Analyst QA', 1, 0]])
    assert.equal(json.alignment.totalTasksLogged, 3)
    assert.equal(json.workRoleReport.totalTasks, 2)
    assert.deepEqual(json.workRoleReport.tickets, { total: 3, done: 2, doing: 1, backlog: 0, withNotes: 3 })
    const all = await (await admin.request.get(endpoint + '?inScopeOnly=false')).json()
    assert.equal(all.workRoleReport.roles.length, 3)
    assert.equal(all.workRoleReport.totalTasks, 3)
    assert.equal(all.workRoleReport.focus.find((f: any) => f.label === 'Policy / governance').count, 1)
    const htmlResponse = await admin.request.get(endpoint + '/export?inScopeOnly=true')
    assert.equal(htmlResponse.status(), 200)
    assert.equal(htmlResponse.headers()['cache-control'], 'private, no-store')
    const html = await htmlResponse.text()
    assert.ok(html.includes('System Administrator QA — 2 tasks'))
    assert.ok(html.includes('Cyber Defense Analyst QA — 1 tasks'))
    assert.ok(!html.includes('<script>bad()'))
    assert.ok(html.includes('&lt;script&gt;bad()'))
    assert.ok(!html.includes('<img src=x'))
    const page = await admin.newPage()
    const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message))
    await page.goto(`/reports/${users[1].id}`)
    const breakdown = page.getByRole('region', { name: 'Work roles and tasks' })
    await breakdown.getByText(/System Administrator QA — 2 tasks/).waitFor()
    assert.ok(await page.getByText('Activity Timeline', { exact: true }).isVisible())
    await page.getByLabel('Course roles only').uncheck()
    await breakdown.getByText(/Policy Specialist QA — 1 tasks/).waitFor()
    await mkdir('/tmp/report-work-roles-qa', { recursive: true })
    await page.screenshot({ path: '/tmp/report-work-roles-qa/desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await breakdown.scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/report-work-roles-qa/mobile.png' })
    const exported = await admin.newPage(); await exported.setContent(html)
    assert.equal(await exported.locator('script').count(), 0)
    await exported.pdf({ path: '/tmp/report-work-roles-qa/report.pdf', format: 'Letter' })
    assert.deepEqual(errors, [])
    console.log('PASS report API, assigned/instructor attribution, role ordering, counts, filters, access control, HTML escaping, desktop/mobile and printable export')
  } finally {
    await browser.close()
    if (course) await db.classWorkspace.delete({ where: { id: course.id } })
    await db.dcwfKsat.deleteMany({ where: { id: { in: tasks.map(t => t.id) } } })
    await db.dcwfWorkRole.deleteMany({ where: { id: { in: roles.map(r => r.id) } } })
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } })
    await db.$disconnect()
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Report test failed'); process.exitCode = 1 })
