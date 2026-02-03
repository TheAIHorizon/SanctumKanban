'use client'

import { useState } from 'react'
import { TeamKanban } from '@/components/kanban/TeamKanban'
import { HeatMapView } from './HeatMapView'
import { Button } from '@/components/ui/button'
import { LayoutGrid, Map, ChevronLeft } from 'lucide-react'

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

type ViewMode = 'detailed' | 'overview' | 'focused'

export function TeamGrid({ teams, currentUser }: TeamGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detailed')
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null)

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

  const handleTeamClick = (teamId: string) => {
    setFocusedTeamId(teamId)
    setViewMode('focused')
  }

  const handleBackToOverview = () => {
    setFocusedTeamId(null)
    setViewMode('overview')
  }

  const focusedTeam = focusedTeamId
    ? teams.find((t) => t.id === focusedTeamId)
    : null

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {viewMode === 'focused' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToOverview}
              className="mr-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Overview
            </Button>
          )}
          {viewMode !== 'focused' && (
            <h2 className="text-lg font-semibold">
              {teams.length} Team{teams.length !== 1 ? 's' : ''}
            </h2>
          )}
          {viewMode === 'focused' && focusedTeam && (
            <h2 className="text-lg font-semibold">{focusedTeam.name}</h2>
          )}
        </div>
        {viewMode !== 'focused' && (
          <div className="flex items-center border rounded-lg p-1 bg-muted/50">
            <Button
              variant={viewMode === 'detailed' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('detailed')}
              className="h-8"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Detailed
            </Button>
            <Button
              variant={viewMode === 'overview' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('overview')}
              className="h-8"
            >
              <Map className="h-4 w-4 mr-1" />
              Overview
            </Button>
          </div>
        )}
      </div>

      {/* Content based on view mode */}
      {viewMode === 'overview' && (
        <HeatMapView teams={teams} onTeamClick={handleTeamClick} />
      )}

      {viewMode === 'detailed' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {teams.map((team) => {
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
      )}

      {viewMode === 'focused' && focusedTeam && (
        <div className="max-w-4xl">
          {(() => {
            const userMembership = focusedTeam.members.find(
              (m) => m.userId === currentUser.id
            )
            const isTeamLead =
              currentUser.role === 'ADMIN' || userMembership?.role === 'LEAD'

            return (
              <TeamKanban
                team={focusedTeam}
                currentUser={currentUser}
                isTeamLead={isTeamLead}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}
