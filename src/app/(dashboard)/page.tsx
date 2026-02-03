import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner'
import { TeamGrid } from '@/components/dashboard/TeamGrid'

async function getTeams(userId: string, role: string) {
  if (role === 'ADMIN') {
    // Admins can see all teams
    return prisma.team.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                color: true,
              },
            },
          },
        },
        tickets: {
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                color: true,
              },
            },
          },
          orderBy: [{ status: 'asc' }, { position: 'asc' }],
        },
        reflections: {
          orderBy: { weekOf: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  // Team leads and members can only see their teams
  return prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              color: true,
            },
          },
        },
      },
      tickets: {
        include: {
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              color: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
      },
      reflections: {
        orderBy: { weekOf: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })
}

async function getAnnouncements() {
  return prisma.announcement.findMany({
    where: {
      OR: [
        { pinned: true },
        {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      ],
    },
    include: {
      author: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 5,
  })
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return null
  }

  const [teams, announcements] = await Promise.all([
    getTeams(session.user.id, session.user.role),
    getAnnouncements(),
  ])

  return (
    <div className="space-y-6">
      <AnnouncementBanner announcements={announcements} />
      <TeamGrid teams={teams} currentUser={session.user} />
    </div>
  )
}
