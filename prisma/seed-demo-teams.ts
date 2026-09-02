import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

// 5 teams; total tickets per team and the 20/30/50 split across 3 members.
const TEAMS = [
  { id: 'demo-alpha', name: 'Team Alpha', total: 10, split: [2, 3, 5] },
  { id: 'demo-bravo', name: 'Team Bravo', total: 20, split: [4, 6, 10] },
  { id: 'demo-charlie', name: 'Team Charlie', total: 30, split: [6, 9, 15] },
  { id: 'demo-delta', name: 'Team Delta', total: 40, split: [8, 12, 20] },
  { id: 'demo-echo', name: 'Team Echo', total: 50, split: [10, 15, 25] },
]

// 3 member "roles" per team, each themed toward different DCWF work via keyword
// buckets, so individual alignment reports come out visibly different.
const MEMBER_THEMES = [
  { suffix: 'Infra', color: '#3b82f6', kw: ['active directory', 'domain', 'account', 'backup', 'system', 'email', 'workstation'] },
  { suffix: 'Sec', color: '#ef4444', kw: ['vulnerability', 'incident', 'firewall', 'harden', 'patch', 'monitor', 'forensic'] },
  { suffix: 'Data', color: '#84cc16', kw: ['database', 'web', 'schema', 'query', 'application', 'data', 'develop'] },
]
const FIRST = ['Alex', 'Jordan', 'Sam', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Drew', 'Quinn', 'Avery', 'Parker', 'Reese', 'Skyler', 'Rowan']

const STATUSES = ['BACKLOG', 'DOING', 'DONE'] as const
const TICKET_DESC = (theme: string, i: number) =>
  `${theme} work item #${i}: configure, verify, and document per the enterprise network requirements.`

// due date variety
function dueFor(i: number): Date | null {
  const m = i % 5
  if (m === 0) return new Date(now - (2 + (i % 6)) * DAY) // overdue
  if (m === 1) return new Date(now + (1 + (i % 2)) * DAY) // soon
  if (m === 2) return new Date(now + (6 + (i % 20)) * DAY) // ok
  return null // no due date
}

async function main() {
  console.log('Seeding 5 demo teams with task/role variation...\n')
  const pw = await bcrypt.hash('password123', 12)

  // Ensure an admin exists (create if a fresh DB has none) so this script is
  // self-sufficient for a fresh deploy.
  let admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('admin123', 12),
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        color: '#ef4444',
      },
    })
    console.log('Created admin@example.com / admin123')
  }

  // Put all populated demo boards in one class workspace.
  let demoClass = await prisma.classWorkspace.findFirst({
    where: { name: 'IST 4910 Demo Class', archivedAt: null },
  })
  if (!demoClass) {
    demoClass = await prisma.classWorkspace.create({
      data: {
        name: 'IST 4910 Demo Class',
        code: 'IST 4910',
        term: 'Demo',
        description: 'Populated demonstration class with varied team workloads and DCWF activity.',
        createdById: admin.id,
      },
    })
  }

  // Keep the original sample team in the same demo class when base seed ran first.
  await prisma.team.updateMany({
    where: { id: 'sample-team-1' },
    data: { classWorkspaceId: demoClass.id },
  })
  const sampleMembers = await prisma.teamMember.findMany({
    where: { teamId: 'sample-team-1' },
    select: { userId: true },
  })
  await prisma.classWorkspaceMember.createMany({
    data: sampleMembers.map(({ userId }) => ({ classWorkspaceId: demoClass.id, userId })),
    skipDuplicates: true,
  })

  // DCWF data is required for the ticket↔task links that light up reports.
  const dcwfCount = await prisma.dcwfKsat.count()
  if (dcwfCount === 0) {
    throw new Error('No DCWF data found. Run `npm run db:import-dcwf` first, then re-run this.')
  }

  // Pre-fetch in-scope Task ksats grouped by keyword bucket for theming.
  const allTasks = await prisma.dcwfKsat.findMany({
    where: { type: 'Task', roles: { some: { workRole: { inScope: true } } } },
    select: { id: true, description: true },
  })
  function tasksForKeywords(kw: string[], count: number): string[] {
    const matched = allTasks.filter((t) => kw.some((k) => t.description.toLowerCase().includes(k)))
    const pool = matched.length >= 3 ? matched : allTasks
    const ids: string[] = []
    for (let i = 0; i < count; i++) ids.push(pool[i % pool.length].id)
    return ids
  }

  let firstIdx = 0
  for (const team of TEAMS) {
    // Create/refresh team
    await prisma.ticketDcwfTask.deleteMany({ where: { ticket: { teamId: team.id } } }).catch(() => {})
    await prisma.ticket.deleteMany({ where: { teamId: team.id } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { teamId: team.id } }).catch(() => {})
    const t = await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name, classWorkspaceId: demoClass.id },
      create: { id: team.id, name: team.name, description: `Enterprise network build — ${team.total} tasks`, classWorkspaceId: demoClass.id },
    })

    // 3 members
    const members: { id: string; theme: typeof MEMBER_THEMES[number] }[] = []
    for (let m = 0; m < 3; m++) {
      const theme = MEMBER_THEMES[m]
      const first = FIRST[firstIdx++ % FIRST.length]
      const last = `${team.name.split(' ')[1]}${theme.suffix}`
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`
      const u = await prisma.user.upsert({
        where: { email },
        update: { color: theme.color },
        create: {
          email, passwordHash: pw, firstName: first, lastName: last,
          role: m === 0 ? 'TEAM_LEAD' : 'MEMBER', color: theme.color,
        },
      })
      await prisma.teamMember.create({ data: { teamId: t.id, userId: u.id, role: m === 0 ? 'LEAD' : 'MEMBER' } })
      await prisma.classWorkspaceMember.upsert({
        where: { classWorkspaceId_userId: { classWorkspaceId: demoClass.id, userId: u.id } },
        update: {},
        create: { classWorkspaceId: demoClass.id, userId: u.id },
      })
      members.push({ id: u.id, theme })
    }

    // Tickets, split 20/30/50 across the 3 members
    let ticketNo = 0
    const posByStatus: Record<string, number> = { BACKLOG: 0, DOING: 0, DONE: 0 }
    for (let m = 0; m < 3; m++) {
      const count = team.split[m]
      const member = members[m]
      const taskIds = tasksForKeywords(member.theme.kw, count)
      for (let i = 0; i < count; i++) {
        ticketNo++
        // status: skew toward DONE for higher performers so it looks like progress
        const status = STATUSES[(m + i) % 3]
        posByStatus[status]++
        const due = dueFor(ticketNo)
        const ticket = await prisma.ticket.create({
          data: {
            title: `${member.theme.suffix}: ${['Configure','Deploy','Harden','Document','Verify','Test','Integrate'][i % 7]} ${['AD','firewall','database','web server','email','monitoring','backup'][i % 7]}`,
            description: TICKET_DESC(member.theme.suffix, i + 1),
            status,
            position: posByStatus[status],
            teamId: t.id,
            assigneeId: member.id,
            createdById: member.id,
            dueDate: due ?? undefined,
          },
        })
        // Link a DCWF task with a reflection note (so alignment + reports populate)
        await prisma.ticketDcwfTask.create({
          data: {
            ticketId: ticket.id,
            ksatId: taskIds[i],
            note: `${member.theme.suffix} task ${i + 1}: completed and verified against requirements.`,
            createdById: member.id,
          },
        })
      }
    }
    console.log(`${team.name}: ${team.total} tickets · members ${members.map((m, i) => `${m.theme.suffix}=${team.split[i]}`).join(' ')}`)
  }

  // Remove an empty automatic legacy class if the app was opened before this
  // demo seed moved all boards into IST 4910 Demo Class.
  await prisma.classWorkspace.deleteMany({
    where: { name: 'Current Class', teams: { none: {} } },
  })

  const [teams, users, tickets, links] = await Promise.all([
    prisma.team.count(), prisma.user.count(), prisma.ticket.count(), prisma.ticketDcwfTask.count(),
  ])
  console.log(`\nTotals — teams: ${teams}, users: ${users}, tickets: ${tickets}, dcwf links: ${links}`)
  console.log('Demo members log in with password: password123')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
