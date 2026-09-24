// Owned synthetic fixtures only. Never point this script at the NAS.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { chat } from '../src/lib/ai'
import { runAssessmentJob } from '../src/lib/assessment-worker.server'
import { collectEvidence } from '../src/lib/assessment-data.server'
import type { AssessmentQuestion } from '../src/lib/assessments'
const base = process.env.GA_BASE_URL
const url = new URL(process.env.DATABASE_URL || 'file:///missing')
assert.equal(base, 'http://127.0.0.1:3459'); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55439'); assert.equal(url.pathname, '/sanctum_ga_check')
async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const browser = await chromium.launch({ headless: true })
  const db = new PrismaClient({ log: [] })
  const suffix = randomUUID(), password = randomBytes(24).toString('base64url'), passwordHash = await bcrypt.hash(password, 10)
  const users: any[] = [], classes: any[] = []; const errors: string[] = []
  const output = process.env.ASSESSMENT_QA_OUTPUT || '/tmp/sanctum-course-check'
  await mkdir(output, { recursive: true })
  let passCount = 0
  const pass = (s: string) => { passCount++; console.log('PASS ' + s) }
  async function login(u: any) {
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } })
    const csrf = await (await context.request.get('/api/auth/csrf')).json()
    await context.request.post(u.role === 'OBSERVER' ? '/api/auth/callback/observer' : '/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: u.email, password, callbackUrl: base, json: 'true' } })
    const loggedIn = (await (await context.request.get('/api/auth/session')).json()).user
    assert.ok(loggedIn, `Login failed for ${u.role}`)
    assert.equal(loggedIn.role, u.role)
    const page = await context.newPage(); page.on('pageerror', (e: Error) => errors.push(e.message))
    return { context, page, api: context.request }
  }
  try {
    for (const [firstName, role] of [['Staff', 'ADMIN'], ['Student', 'TEAM_LEAD'], ['Other', 'MEMBER'], ['Observer', 'OBSERVER']]) users.push(await db.user.create({ data: { firstName, lastName: 'CourseQA', email: `${firstName}-${suffix}@example.invalid`, passwordHash, role: role as any } }))
    for (let i = 0; i < 2; i++) classes.push(await db.classWorkspace.create({ data: { name: `Course QA ${suffix}-${i}`, createdById: users[0].id, members: { create: (i ? [users[2]] : users.slice(0, 3)).map(u => ({ userId: u.id })) } } }))
    const team = await db.team.create({ data: { name: 'Team One QA', classWorkspaceId: classes[0].id, members: { create: { userId: users[1].id, role: 'LEAD' } } } })
    const otherTeam = await db.team.create({ data: { name: 'Team Two QA', classWorkspaceId: classes[0].id } })
    const evidence = [
      ['Configure Linux SSH authentication', 'Configured an SSH daemon with public-key authentication. Created an Ed25519 key pair, installed the public key in authorized_keys, checked file ownership and permissions, disabled password login after testing a second session, and reviewed auth logs for failed access attempts. Verified service status and firewall rules.'],
      ['Troubleshoot DNS resolution', 'Compared recursive lookup results with dig and nslookup. Checked authoritative records, A and AAAA responses, TTL and caching. Distinguished NXDOMAIN from SERVFAIL. Flushed a local cache, compared results against an internal DNS server, and checked TCP and UDP port 53 connectivity. Recorded test results and the root cause.'],
      ['Analyze network traffic', 'Captured synthetic lab traffic with tcpdump and inspected the packets in Wireshark. Applied capture and display filters. Identified the TCP three-way handshake, retransmissions, and DNS queries. Compared source and destination addresses, ports and sequence numbers to diagnose an intentionally blocked connection in the lab.'],
    ]
    const tickets: { id: string }[] = []
    for (const [title, description] of evidence) tickets.push(await db.ticket.create({ data: { title, description, status: 'DONE', teamId: team.id, createdById: users[1].id, assigneeId: users[1].id, startDate: new Date('2026-09-01'), dueDate: new Date('2026-10-10'), startedAt: new Date('2026-09-02'), completedAt: new Date('2026-09-20') } }))
    await db.ticket.create({ data: { title: 'Secret other team sentinel', description: 'Must not export with Team One.', teamId: otherTeam.id, createdById: users[0].id } })
    const delegated = await db.ticket.create({ data: { title: 'Delegated task sentinel', description: evidence[0][1], status: 'DONE', teamId: team.id, createdById: users[1].id, assigneeId: users[2].id } })
    const collected = await collectEvidence(db, users[1].id, classes[0].id, '2026-01-01', '2026-12-31')
    assert.ok(!collected.some(e => e.id === delegated.id)); assert.equal(collected.length, 3)
    pass('evidence uses assigned work and does not count creating someone else’s ticket')
    const admin = await login(users[0]), student = await login(users[1]), other = await login(users[2]), observer = await login(users[3])
    await student.page.goto('/?classId=' + classes[0].id)
    const panel = student.page.getByRole('button', { name: /Team One QA.*member/ })
    await panel.waitFor(); assert.equal(await panel.getAttribute('aria-expanded'), 'false')
    await panel.click(); assert.equal(await panel.getAttribute('aria-expanded'), 'true')
    assert.equal(await student.page.getByRole('button', { name: /Team Two QA.*member/ }).getAttribute('aria-expanded'), 'false')
    await panel.click(); await student.page.keyboard.press('n')
    assert.equal(await student.page.getByRole('dialog').count(), 0)
    await student.page.screenshot({ path: output + '/collapsed-teams.png', fullPage: true })
    pass('teams start collapsed, expand independently, and hidden boards ignore keyboard shortcuts')
    await student.page.getByRole('button', { name: 'Export Team One QA', exact: true }).click()
    await student.page.getByLabel('View', { exact: true }).selectOption('gantt')
    await student.page.getByLabel('From', { exact: true }).fill('2026-09-01')
    await student.page.getByLabel('Through', { exact: true }).fill('2026-10-31')
    for (const paper of ['letter', 'tabloid']) {
      await student.page.getByLabel('Paper size').selectOption(paper)
      const link = await student.page.getByRole('link', { name: 'Print / Save PDF' }).getAttribute('href')
      const exportPage = await student.context.newPage()
      const response = await exportPage.goto(link)
      assert.equal(response.status(), 200)
      const html = await exportPage.content(); assert.ok(!html.includes('Secret other team sentinel'))
      await exportPage.pdf({ path: `${output}/team-gantt-${paper}.pdf`, preferCSSPageSize: true, printBackground: true })
      await exportPage.screenshot({ path: `${output}/team-gantt-${paper}.png`, fullPage: true })
      await exportPage.close()
    }
    const query = '?view=gantt&paper=letter&from=2026-09-01&to=2026-10-31'
    assert.equal((await student.api.get(`/api/teams/${team.id}/export${query}`)).status(), 200)
    const outside = await db.team.create({ data: { name: 'Outside course', classWorkspaceId: classes[1].id } })
    assert.equal((await student.api.get(`/api/teams/${outside.id}/export${query}`)).status(), 404)
    pass('team-only exports preserve class permissions and render Letter/Tabloid PDFs')
    const payload = { classId: classes[0].id, studentId: users[1].id, from: '2026-01-01', to: '2026-12-31', mode: 'PRACTICE' }
    assert.equal((await other.api.post('/api/assessments', { data: payload })).status(), 404)
    assert.equal((await observer.api.post('/api/assessments', { data: payload })).status(), 404)
    assert.equal((await student.api.post('/api/assessments', { data: { ...payload, mode: 'EXAM' } })).status(), 403)
    const queuedResponse = await student.api.post('/api/assessments', { data: payload }); assert.equal(queuedResponse.status(), 202)
    const queued = await queuedResponse.json()
    assert.equal((await student.api.post('/api/assessments', { data: payload })).status(), 409)
    let batch = 0
    const fake = async (messages: any[]) => {
      const data = JSON.parse(messages[1].content), kind = data.kind
      const questions = Array.from({ length: data.questionCount }, (_, i) => ({ stem: `For version ${data.version}, scenario ${batch * 5 + i}, which diagnostic action provides evidence?`, options: ['Inspect service logs', 'Discard all logs', 'Ignore failures', 'Delete every configuration'], correctIndex: 0, explanation: 'Inspecting service logs supplies observed evidence. Discarding logs removes evidence; ignoring failures does not diagnose them; deleting configuration is destructive.', kind, sourceIds: [tickets[i % tickets.length].id] }))
      batch++; return JSON.stringify({ questions })
    }
    await runAssessmentJob(db, fake)
    const ready = await (await student.api.get(`/api/assessments/${queued.id}`)).json()
    assert.equal(ready.status, 'READY'); assert.equal(ready.questions.length, 25)
    assert.ok(!JSON.stringify(ready).includes('correctIndex')); assert.ok(!JSON.stringify(ready).includes('explanation'))
    assert.equal((await other.api.get(`/api/assessments/${queued.id}`)).status(), 404)
    pass('persistent generation validates 25 questions, isolates students, and withholds answer keys')
    await student.page.goto('/assessments')
    await student.page.getByLabel('Course', { exact: true }).selectOption(classes[0].id)
    await student.page.getByRole('button', { name: /Practice · READY/ }).click()
    await student.page.getByRole('group', { name: 'Question 1 · concept', exact: true }).waitFor()
    for (let i = 0; i < 25; i++) await student.page.locator(`input[name="question-${i}"]`).first().check()
    await student.page.getByRole('button', { name: 'Submit all 25 answers' }).click()
    await student.page.getByText(/Practice score:/).waitFor()
    await student.page.screenshot({ path: output + '/practice-result.png', fullPage: true })
    const submitted = await (await student.api.get(`/api/assessments/${queued.id}`)).json()
    assert.ok(submitted.questions[0].explanation)
    assert.equal((await student.api.patch(`/api/assessments/${queued.id}`, { data: { action: 'submit', answers: Array(25).fill(0) } })).status(), 409)
    pass('students complete a practice test in-browser and cannot resubmit the saved attempt')
    await db.assessment.update({ where: { id: queued.id }, data: { createdAt: new Date(Date.now() - 120000) } })
    const exam = await (await admin.api.post('/api/assessments', { data: { ...payload, mode: 'EXAM', references: 'Use evidence-based troubleshooting.' } })).json()
    assert.ok(exam.id); batch = 0; await runAssessmentJob(db, fake)
    assert.equal((await student.api.get(`/api/assessments/${exam.id}`)).status(), 404)
    assert.equal((await student.api.get(`/api/assessments/${exam.id}/export?key=1`)).status(), 403)
    assert.equal((await admin.api.get(`/api/assessments/${exam.id}/export`)).status(), 409)
    await admin.page.goto('/assessments'); await admin.page.getByLabel('Course', { exact: true }).selectOption(classes[0].id); await admin.page.getByLabel('Student', { exact: true }).selectOption(users[1].id)
    await admin.page.getByRole('button', { name: /Exam · READY/ }).click()
    await admin.page.getByLabel('Question 1 text', { exact: true }).fill('Which observation gives the strongest evidence of a successful SSH authentication?')
    await admin.page.getByRole('button', { name: 'Save edits', exact: true }).click()
    await admin.page.getByRole('button', { name: 'Accept exam', exact: true }).click()
    await admin.page.getByRole('link', { name: 'Print student exam', exact: true }).waitFor()
    const accepted = await (await admin.api.get(`/api/assessments/${exam.id}`)).json(); assert.equal(accepted.approvalMethod, 'EDITED')
    const testHtml = await (await admin.api.get(`/api/assessments/${exam.id}/export`)).text()
    const keyHtml = await (await admin.api.get(`/api/assessments/${exam.id}/export?key=1`)).text()
    assert.ok(!testHtml.includes('Inspecting service logs supplies')); assert.ok(keyHtml.includes('Inspecting service logs supplies'))
    pass('instructor edits and accepts a private exam with separate student and answer-key exports')
    // Prove a canceled in-flight inference cannot publish stale results.
    await db.assessment.update({ where: { id: exam.id }, data: { createdAt: new Date(Date.now() - 120000) } })
    const cancel = await (await student.api.post('/api/assessments', { data: payload })).json()
    batch = 0
    await runAssessmentJob(db, async messages => { await student.api.patch(`/api/assessments/${cancel.id}`, { data: { action: 'cancel' } }); return fake(messages) })
    assert.equal((await db.assessment.findUniqueOrThrow({ where: { id: cancel.id } })).status, 'FAILED')
    await db.classWorkspace.update({ where: { id: classes[0].id }, data: { archivedAt: new Date() } })
    assert.equal((await student.api.post('/api/assessments', { data: payload })).status(), 409)
    assert.equal((await student.api.get(`/api/assessments/${queued.id}`)).status(), 200)
    pass('cancel fences in-flight results; archived classes retain reads and reject generation')
    assert.deepEqual(errors, [])
    if (process.env.ASSESSMENT_REAL_AI === '1') {
      await db.classWorkspace.update({ where: { id: classes[0].id }, data: { archivedAt: null } })
      await db.assessment.updateMany({ where: { studentId: users[1].id }, data: { createdAt: new Date(Date.now() - 120000) } })
      const real = await (await student.api.post('/api/assessments', { data: payload })).json()
      assert.ok(real.id)
      let realBatch = 0
      await runAssessmentJob(db, async (messages, options) => {
        const started = Date.now()
        const value = await chat(messages, options).catch(e => { console.log('Synthetic AI call failed: ' + String(e.message).slice(0, 160)); throw e })
        await import('node:fs/promises').then(fs => fs.writeFile(`${output}/synthetic-ai-batch-${realBatch++}.json`, value))
        console.log(`AI batch ${realBatch} returned in ${Math.round((Date.now() - started) / 1000)} seconds`)
        return value
      })
      const result = await db.assessment.findUniqueOrThrow({ where: { id: real.id } })
      assert.equal(result.status, 'READY', 'Configured model must return a validated 25-question test')
      await import('node:fs/promises').then(fs => fs.writeFile(output + '/synthetic-ai-questions.json', JSON.stringify(result.questions, null, 2)))
      pass('configured user-owned model generated a validated 25-question test from synthetic student work')
    }
    console.log(`PASS ${passCount} integration/browser groups; output ${output}`)
  } finally {
    await browser.close()
    await db.classWorkspace.deleteMany({ where: { id: { in: classes.map(c => c.id) } } })
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } })
    await db.$disconnect()
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Check failed'); process.exitCode = 1 })
