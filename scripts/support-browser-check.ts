// Owned synthetic fixtures, on the separate local QA database only.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const base = process.env.GA_BASE_URL
const url = new URL(process.env.DATABASE_URL || 'file:///missing')
assert.equal(base, 'http://127.0.0.1:3459'); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55439'); assert.equal(url.pathname, '/sanctum_ga_check')
async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const browser = await chromium.launch({ headless: true }), db = new PrismaClient({ log: [] })
  const users: any[] = [], postIds: string[] = [], errors: string[] = []
  const suffix = randomUUID(), password = randomBytes(24).toString('base64url'), passwordHash = await bcrypt.hash(password, 10)
  async function login(u: any) {
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } })
    const csrf = await (await context.request.get('/api/auth/csrf')).json()
    await context.request.post(u ? '/api/auth/callback/credentials' : '/api/auth/callback/observer', { form: { csrfToken: csrf.csrfToken, email: u?.email || '', password, json: 'true', callbackUrl: base! } })
    const page = await context.newPage(); page.on('pageerror', (e: Error) => errors.push(e.message))
    return { context, page, api: context.request }
  }
  try {
    for (const role of ['ADMIN', 'TEAM_LEAD', 'MEMBER']) users.push(await db.user.create({ data: { firstName: role, lastName: 'SupportQA', email: `support-${role}-${suffix}@example.invalid`, passwordHash, role: role as any } }))
    const admin = await login(users[0]), student = await login(users[1]), other = await login(users[2]), observer = await login(null)
    const anonymous = await browser.newContext({ baseURL: base })
    assert.equal((await anonymous.request.get('/api/support')).status(), 401)
    assert.equal((await observer.api.get('/api/support')).status(), 403)
    assert.equal((await observer.api.post('/api/support', { data: {} })).status(), 403)
    await observer.page.goto('/support'); assert.equal(new URL(observer.page.url()).pathname, '/')
    console.log('PASS anonymous and observer access denied')
    await student.page.goto('/support')
    await student.page.getByLabel('Title', { exact: true }).fill('Synthetic chart display bug')
    await student.page.getByLabel('Description', { exact: true }).fill('Expected a chart after switching views; instead the area is blank. <script>not executed</script>')
    await student.page.getByLabel('Steps to reproduce (optional)').fill('Open the board, then switch to Gantt.')
    await student.page.getByRole('button', { name: 'Submit post', exact: true }).click()
    await student.page.getByRole('status').filter({ hasText: 'Your post was submitted' }).waitFor()
    const list = await (await student.api.get('/api/support')).json(); assert.equal(list.total, 1); const post = list.posts[0]; postIds.push(post.id)
    assert.equal(post.status, 'NEW'); assert.equal(post.kind, 'BUG'); assert.ok(!JSON.stringify(post).includes('passwordHash'))
    assert.equal((await other.api.get('/api/support/' + post.id)).status(), 404)
    assert.equal((await (await other.api.get('/api/support')).json()).total, 0)
    assert.equal((await student.api.patch('/api/support/' + post.id, { data: { status: 'RESOLVED', staffReply: 'fake', updatedAt: post.updatedAt } })).status(), 403)
    assert.equal((await student.api.post('/api/support', { data: { kind: 'BUG', title: 'Bad payload', description: 'Trying to set another author.', authorId: users[2].id } })).status(), 400)
    console.log('PASS browser bug submission, escaped text, private reads, and staff-only mutation')
    await admin.page.goto('/support'); await admin.page.getByRole('button', { name: /Synthetic chart display bug/ }).click()
    await admin.page.getByLabel('Status', { exact: true }).selectOption('IN_PROGRESS')
    await admin.page.getByLabel('Response to submitter').fill('We reproduced this and are investigating.')
    await admin.page.getByRole('button', { name: 'Save response', exact: true }).click()
    await admin.page.getByRole('status').filter({ hasText: 'Status and response saved' }).waitFor()
    assert.equal((await admin.api.patch('/api/support/' + post.id, { data: { status: 'CLOSED', staffReply: 'stale', updatedAt: post.updatedAt } })).status(), 409)
    await student.page.getByRole('button', { name: 'Refresh submissions' }).click(); await student.page.getByRole('button', { name: /Synthetic chart display bug/ }).click()
    await student.page.getByText('We reproduced this and are investigating.', { exact: true }).waitFor()
    assert.equal(await student.page.getByRole('button', { name: 'Save response' }).count(), 0)
    console.log('PASS staff response, status updates, optimistic conflict and student follow-up')
    await student.page.getByLabel('Post type').selectOption('FEATURE'); assert.equal(await student.page.getByLabel('Steps to reproduce (optional)').count(), 0)
    await student.page.getByLabel('Title', { exact: true }).fill('Synthetic feature suggestion'); await student.page.getByLabel('Description', { exact: true }).fill('Add an example improvement for synthetic QA.')
    await student.page.getByRole('button', { name: 'Submit post', exact: true }).click(); await student.page.getByRole('status').filter({ hasText: 'Your post was submitted' }).waitFor()
    const newList = await (await student.api.get('/api/support?kind=FEATURE')).json(); assert.equal(newList.total, 1); postIds.push(newList.posts[0].id)
    await student.page.getByLabel('Filter by type').selectOption('FEATURE'); await student.page.getByRole('button', { name: /Synthetic feature suggestion/ }).waitFor(); assert.equal(await student.page.getByRole('button', { name: /Synthetic chart display bug/ }).count(), 0)
    await student.page.setViewportSize({ width: 390, height: 844 }); assert.equal(await student.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await student.page.evaluate(() => window.scrollTo(0, 0))
    await student.page.screenshot({ path: '/tmp/sanctum-support-mobile.png', fullPage: true })
    console.log('PASS feature submission, filtering, and mobile layout')
    const bulk = await db.supportPost.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ authorId: users[2].id, kind: 'FEATURE', title: 'Pagination fixture ' + i, description: 'Owned synthetic pagination fixture.' })) }); assert.equal(bulk.count, 26)
    assert.equal((await (await other.api.get('/api/support')).json()).posts.length, 25); assert.equal((await (await other.api.get('/api/support?page=2')).json()).posts.length, 1)
    assert.equal((await other.api.post('/api/support', { data: { kind: 'FEATURE', title: 'Excess submission', description: 'This account has exceeded the daily limit.' } })).status(), 429)
    await db.user.delete({ where: { id: users[1].id } }); const retained = await (await admin.api.get('/api/support/' + post.id)).json(); assert.equal(retained.id, post.id); assert.equal(retained.author, null)
    assert.deepEqual(errors, []); console.log('PASS pagination, daily limit, deleted-author retention and no browser errors')
  } finally {
    await db.supportPost.deleteMany({ where: { OR: [{ authorId: { in: users.map(u => u.id) } }, { id: { in: postIds } }] } })
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } })
    await browser.close(); await db.$disconnect()
  }
}
main().catch(error => { console.error('Support browser check failed:', error.message); process.exitCode = 1 })
