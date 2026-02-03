import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      color: '#ef4444',
    },
  })
  console.log('Created admin user:', admin.email)

  // Create some sample users
  const samplePassword = await bcrypt.hash('password123', 12)
  
  const user1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      passwordHash: samplePassword,
      firstName: 'John',
      lastName: 'Doe',
      role: 'TEAM_LEAD',
      color: '#3b82f6',
      contactInfo: 'Slack: @johndoe',
    },
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      email: 'jane@example.com',
      passwordHash: samplePassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'MEMBER',
      color: '#22c55e',
    },
  })

  const user3 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      passwordHash: samplePassword,
      firstName: 'Bob',
      lastName: 'Wilson',
      role: 'MEMBER',
      color: '#f59e0b',
    },
  })

  console.log('Created sample users')

  // Create a sample team
  const team = await prisma.team.upsert({
    where: { id: 'sample-team-1' },
    update: {},
    create: {
      id: 'sample-team-1',
      name: 'Development Team',
      description: 'Main product development team',
      members: {
        create: [
          { userId: user1.id, role: 'LEAD' },
          { userId: user2.id, role: 'MEMBER' },
          { userId: user3.id, role: 'MEMBER' },
        ],
      },
    },
  })
  console.log('Created sample team:', team.name)

  // Create sample tickets
  const tickets = await Promise.all([
    prisma.ticket.create({
      data: {
        title: 'Set up project structure',
        description: 'Initialize the project with Next.js and configure the development environment',
        status: 'DONE',
        position: 1,
        teamId: team.id,
        assigneeId: user1.id,
        createdById: admin.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Design database schema',
        description: 'Create the Prisma schema for users, teams, and tickets',
        status: 'DONE',
        position: 2,
        teamId: team.id,
        assigneeId: user2.id,
        createdById: admin.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Implement authentication',
        description: 'Set up NextAuth.js with credentials provider',
        status: 'DOING',
        position: 1,
        teamId: team.id,
        assigneeId: user1.id,
        createdById: admin.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Create kanban board UI',
        description: 'Build the drag-and-drop kanban board component',
        status: 'DOING',
        position: 2,
        teamId: team.id,
        assigneeId: user3.id,
        createdById: admin.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Add real-time updates',
        description: 'Implement Socket.IO for live collaboration',
        status: 'BACKLOG',
        position: 1,
        teamId: team.id,
        assigneeId: null,
        createdById: admin.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Write documentation',
        description: 'Create README and deployment guide',
        status: 'BACKLOG',
        position: 2,
        teamId: team.id,
        assigneeId: null,
        createdById: admin.id,
      },
    }),
  ])
  console.log('Created', tickets.length, 'sample tickets')

  // Create a sample announcement
  const announcement = await prisma.announcement.create({
    data: {
      title: 'Welcome to Sanctum Kanban!',
      content: 'This is your new team collaboration tool. Use the kanban boards to track your tasks and the reflection boards to improve your process. If you have any questions, contact the admin.',
      pinned: true,
      authorId: admin.id,
    },
  })
  console.log('Created sample announcement')

  console.log('Database seeded successfully!')
  console.log('')
  console.log('Login credentials:')
  console.log('  Admin: admin@example.com / admin123')
  console.log('  User 1: john@example.com / password123')
  console.log('  User 2: jane@example.com / password123')
  console.log('  User 3: bob@example.com / password123')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
