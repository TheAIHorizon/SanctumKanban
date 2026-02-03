'use client'

import { TeamKanban } from '@/components/kanban/TeamKanban'

interface User {
  id: string
  firstName: string
  lastName: string
  email?: string
  color: string
}

interface TeamMember {
  id: string
  userId: string
  role: string
  user: User
}

interface Ticket {
  id: string
  title: string
  description: string | null
  status: 'BACKLOG' | 'DOING' | 'DONE'
  position: number
  assignee: User | null
  teamId: string
}

interface Reflection {
  id: string
  wentWell: string | null
  couldImprove: string | null
  actionItems: string | null
  weekOf: Date | string
}

interface Team {
  id: string
  name: string
  description: string | null
  members: TeamMember[]
  tickets: Ticket[]
  reflections: Reflection[]
}

interface CurrentUser {
  id: string
  role: string
  firstName: string
  lastName: string
}

interface TeamGridProps {
  teams: Team[]
  currentUser: CurrentUser
}

export function TeamGrid({ teams, currentUser }: TeamGridProps) {
  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-400">
          No teams yet
        </h2>
        <p className="text-slate-500 dark:text-slate-500 mt-2">
          {currentUser.role === 'ADMIN'
            ? 'Create your first team to get started.'
            : 'You have not been assigned to any teams yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {teams.map((team) => {
        // Check if user is a lead of this team
        const userMembership = team.members.find(
          (m) => m.userId === currentUser.id
        )
        const isTeamLead =
          currentUser.role === 'ADMIN' || userMembership?.role === 'LEAD'

        return (
          <TeamKanban
            key={team.id}
            team={team}
            currentUser={currentUser}
            isTeamLead={isTeamLead}
          />
        )
      })}
    </div>
  )
}
