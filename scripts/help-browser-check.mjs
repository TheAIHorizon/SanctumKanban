// Read-only Help/browser acceptance, except owned synthetic local login accounts.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
const base = process.env.GA_BASE_URL
const db = new URL(process.env.DATABASE_URL || 'file:///missing')
assert.equal(base, 'http://127.0.0.1:3459'); assert.equal(db.hostname, '127.0.0.1'); assert.equal(db.port, '55439'); assert.equal(db.pathname, '/sanctum_ga_check')
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const p = new PrismaClient(); const browser = await chromium.launch({ headless: true })
const users = []; const errors = []; const suffix = randomUUID(); let count = 0
const password = randomBytes(24).toString('base64url'); const passwordHash = await bcrypt.hash(password, 10)
const output = process.env.HELP_QA_OUTPUT || '/tmp/sanctum-help-check'; await mkdir(output, { recursive: true })
const privatePatterns = [
  /(?:\/(?:Users|home)\/|[A-Za-z]:\\Users\\)[^/\\\s"'<>]+(?:[/\\]|(?=[\s"'<>]|$))/i,
  /\/volume\d+\//i,
  /\b10(?:\.\d{1,3}){3}\b/,
  /\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b/,
  /\b192\.168(?:\.\d{1,3}){2}\b/,
  /\.ops\//i,
  /(?:NEXTAUTH_SECRET|DATABASE_URL|SUDO_PASSWORD)/i,
  /postgres(?:ql)?:\/\//i,
]
const adminContentPatterns = [/Instructor tools/i, /Safe GA checklist/i]
const assertSafeResponse = (body, label, role) => {
  for (const pattern of privatePatterns) assert.doesNotMatch(body, pattern, `Private marker leaked in ${label}`)
  if (role !== 'ADMIN') {
    for (const pattern of adminContentPatterns) assert.doesNotMatch(body, pattern, `ADMIN-only content leaked in ${label}`)
  }
}
const rscHeaders = { RSC: '1', 'Next-Router-Prefetch': '1' }
const pass = name => { count++; console.log('PASS ' + name) }
async function session(user) {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } })
  const csrf = await (await context.request.get('/api/auth/csrf')).json()
  const provider = user ? 'credentials' : 'observer'
  await context.request.post('/api/auth/callback/' + provider, { form: { csrfToken: csrf.csrfToken, ...(user ? { email: user.email, password } : {}), callbackUrl: base + '/help', json: 'true' } })
  const info = await (await context.request.get('/api/auth/session')).json()
  assert.equal(info.user.role, user?.role || 'OBSERVER')
  return context
}
try {
  const anon = await browser.newContext({ baseURL: base })
  for (const path of ['/help', '/help/user-manual', '/help/ga-checklist']) {
    const r = await anon.request.get(path, { maxRedirects: 0 })
    assert.ok([302, 303, 307, 308].includes(r.status()), `${path} must require login, received ${r.status()}`)
  }
  await anon.close(); pass('anonymous users cannot access Help content')
  for (const role of ['ADMIN', 'MEMBER', 'TEAM_LEAD']) users.push(await p.user.create({ data: { firstName: 'Help', lastName: role, role, email: `help-${role}-${suffix}@example.invalid`, passwordHash } }))
  for (const user of [...users, null]) {
    const role = user?.role || 'OBSERVER'
    const context = await session(user)
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message))
    await page.goto('/help')
    await page.getByRole('heading', { level: 1 }).waitFor()
    const indexRsc = await context.request.get('/help', { headers: rscHeaders })
    assert.equal(indexRsc.status(), 200, `${role} Help RSC prefetch`)
    assertSafeResponse(await indexRsc.text(), `${role} /help RSC prefetch`, role)
    const links = await page.locator('main a[href^="/help/"]').evaluateAll(nodes => [...new Set(nodes.map(n => n.getAttribute('href')))])
    assert.ok(links.includes('/help/user-manual'))
    assert.equal(links.includes('/help/ga-checklist'), role === 'ADMIN')
    for (const href of links) {
      const r = await context.request.get(href)
      assert.equal(r.status(), 200, `${role} guide ${href}`)
      const body = await r.text()
      assertSafeResponse(body, `${role} guide ${href}`, role)
    }
    for (const slug of ['instructor-tools', 'ga-checklist']) {
      const path = '/help/' + slug
      const expectedStatus = role === 'ADMIN' ? 200 : 404
      const r = await context.request.get(path, { maxRedirects: 0 })
      assert.equal(r.status(), expectedStatus, `${role} direct staff guide ${slug}`)
      const rsc = await context.request.get(path, { headers: rscHeaders, maxRedirects: 0 })
      assert.equal(rsc.status(), expectedStatus, `${role} RSC-prefetched staff guide ${slug}`)
      assertSafeResponse(await rsc.text(), `${role} ${path} RSC prefetch`, role)
    }
    for (const path of ['/help/OPERATIONS.md', '/help/live-operations', '/help/code-review', '/help/%2e%2e%2f.ops%2fsite.local.json', '/docs/ga-system-check.html']) {
      const r = await context.request.get(path, { maxRedirects: 0 })
      assert.ok([400, 404].includes(r.status()), `Unapproved path must not serve content: ${path}, status=${r.status()}`)
    }
    await page.getByRole('link', { name: /Help/i }).first().click()
    await page.waitForURL(url => url.pathname === '/help')
    if (role === 'MEMBER' || role === 'ADMIN') {
      await page.screenshot({ path: `${output}/help-${role.toLowerCase()}.png`, fullPage: true })
      await page.setViewportSize({ width: 390, height: 844 })
      const widths = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
      assert.ok(widths.scroll <= widths.width + 2, `${role} Help page overflows on mobile`)
      await page.getByRole('link', { name: /Help/i }).first().waitFor()
      await page.screenshot({ path: `${output}/help-${role.toLowerCase()}-mobile.png`, fullPage: true })
    }
    await context.close(); pass(`${role} catalogue, direct URL authorization, safe links and header navigation`)
  }
  assert.deepEqual(errors, []); pass('no browser JavaScript exceptions')
  console.log('PASS total ' + count)
} finally {
  await browser.close(); await p.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } }); await p.$disconnect()
}
