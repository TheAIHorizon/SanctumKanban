import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner'
import { TeamGrid } from '@/components/dashboard/TeamGrid'
import { ClassWorkspaceSwitcher } from '@/components/classes/ClassWorkspaceSwitcher'
import { loadClassWorkspaceSummaries } from '@/lib/class-workspaces.server'
import { selectClassWorkspace, visibleClassWorkspaces } from '@/lib/class-workspaces'

async function getTeams(classWorkspaceId: string) {
  const ticketInclude = {
    assignee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        color: true,
      },
    },
    tags: {
      include: {
        tag: true,
      },
    },
    _count: {
      select: { comments: true },
    },
  }

  // Everyone (admin, lead, member, observer) can SEE all teams' boards.
  // Write permissions are enforced per-action in the API via can().
  // Archived tickets are hidden from the boards.
  return prisma.team.findMany({
    where: { classWorkspaceId },
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
        where: { archived: false },
        include: ticketInclude,
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
      },
      tags: true,
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { classId?: string; archived?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) return null

  const archived = searchParams?.archived === '1'
  const allClasses = await loadClassWorkspaceSummaries()
  const visible = visibleClassWorkspaces(
    allClasses.map((workspace) => ({
      ...workspace,
      memberUserIds: workspace.members.map((member) => member.userId),
    })),
    { id: session.user.id, role: session.user.role },
    archived
  )
  const selected = selectClassWorkspace(visible, searchParams?.classId)

  const [teams, announcements] = await Promise.all([
    selected ? getTeams(selected.id) : Promise.resolve([]),
    getAnnouncements(),
  ])

  return (
    <div className="space-y-6">
      <AnnouncementBanner announcements={announcements} />
      <ClassWorkspaceSwitcher
        classes={visible}
        selectedId={selected?.id || null}
        archived={archived}
        canManage={session.user.role === 'ADMIN'}
      />
      <TeamGrid teams={teams} currentUser={session.user} readOnly={archived} />
    </div>
  )
}
