'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TeamKanban } from '@/components/kanban/TeamKanban'
import { HeatMapView } from './HeatMapView'
import { Button } from '@/components/ui/button'
import { LayoutGrid, Map, ChevronLeft, Users } from 'lucide-react'
import { teamsForView } from '@/lib/team-views'
import { GanttView } from './GanttView'
import { TeamExport } from './TeamExport'

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
  startDate?: Date | string | null
  dueDate?: Date | string | null
  completedAt?: Date | string | null
  startedAt?: Date | string | null
  startDateAutoFilled?: boolean
  createdById?: string
  tags?: { tag: { id: string; name: string; color: string } }[]
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
  tags?: { id: string; name: string; color: string }[]
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
  readOnly?: boolean
}

type ViewMode = 'detailed' | 'overview' | 'focused' | 'mine' | 'gantt'

export function TeamGrid({ teams, currentUser, readOnly = false }: TeamGridProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('detailed')
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set())
  const [visitedTeams, setVisitedTeams] = useState<Set<string>>(() => new Set())
  const toggleTeam = (id: string) => {
    if (expandedTeams.has(id)) router.refresh()
    setVisitedTeams(previous => new Set(previous).add(id))
    setExpandedTeams(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const orderedTeams = teamsForView(teams, currentUser.id, false)
  const displayedTeams = teamsForView(teams, currentUser.id, viewMode === 'mine')

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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
              {displayedTeams.length} Team{displayedTeams.length !== 1 ? 's' : ''}
            </h2>
          )}
          {viewMode === 'focused' && focusedTeam && (
            <h2 className="text-lg font-semibold">{focusedTeam.name}</h2>
          )}
        </div>
        {viewMode !== 'focused' && (
          <div className="flex flex-wrap items-center border rounded-lg p-1 bg-muted/50">
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
            {currentUser.role !== 'OBSERVER' && (
              <Button
                variant={viewMode === 'mine' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('mine')}
                className="h-8"
              >
                <Users className="h-4 w-4 mr-1" />
                My Teams
              </Button>
            )}
            <Button
              variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setViewMode('gantt'); router.refresh() }}
              className="h-8"
            >
              Gantt
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'detailed' && <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { setExpandedTeams(new Set(teams.map(t => t.id))); setVisitedTeams(new Set(teams.map(t => t.id))) }}>Expand all teams</Button>
        <Button variant="outline" size="sm" onClick={() => { setExpandedTeams(new Set()); router.refresh() }}>Collapse all teams</Button>
      </div>}
      {/* Content based on view mode */}
      {viewMode === 'gantt' && (
        <GanttView teams={orderedTeams} currentUser={currentUser} readOnly={readOnly} />
      )}
      {viewMode === 'overview' && (
        <HeatMapView teams={orderedTeams} onTeamClick={handleTeamClick} />
      )}

      {viewMode === 'mine' && displayedTeams.length === 0 && (
        <p className="py-8 text-muted-foreground">You are not a member of a team in this class. Use Detailed or Overview to browse its boards.</p>
      )}
      {(viewMode === 'detailed' || viewMode === 'mine') && (
        <div className={viewMode === 'mine' ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 xl:grid-cols-2 gap-6'}>
          {displayedTeams.map((team) => {
            const userMembership = team.members.find(
              (m) => m.userId === currentUser.id
            )
            const isTeamLead =
              !readOnly && (currentUser.role === 'ADMIN' || userMembership?.role === 'LEAD')
            const isMember = !readOnly && !!userMembership

            return (
              <section key={team.id} className="min-w-0 self-start rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  {viewMode === 'detailed' ? <button type="button" className="flex-1 text-left font-semibold" aria-expanded={expandedTeams.has(team.id)} aria-controls={`team-panel-${team.id}`} onClick={() => toggleTeam(team.id)}>
                    {expandedTeams.has(team.id) ? '▾' : '▸'} {team.name}
                    <span className="block text-xs font-normal text-muted-foreground">{team.members.length} member{team.members.length === 1 ? '' : 's'} · {team.tickets.filter(t => t.status === 'BACKLOG').length} backlog · {team.tickets.filter(t => t.status === 'DOING').length} doing · {team.tickets.filter(t => t.status === 'DONE').length} done</span>
                  </button> : <span className="flex-1 font-semibold">{team.name}</span>}
                  <TeamExport teamId={team.id} teamName={team.name} />
                </div>
                <div id={`team-panel-${team.id}`} hidden={viewMode === 'detailed' && !expandedTeams.has(team.id)}>
                  {(viewMode === 'mine' || visitedTeams.has(team.id)) && <TeamKanban
                    team={team}
                    currentUser={readOnly ? { ...currentUser, role: 'OBSERVER' } : currentUser}
                    viewerRole={currentUser.role}
                    readOnly={readOnly}
                    shortcutsEnabled={viewMode === 'mine' || expandedTeams.has(team.id)}
                    isTeamLead={isTeamLead}
                    isMember={isMember}
                  />}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {viewMode === 'focused' && focusedTeam && (
        <div className="w-full">
          <div className="mb-3"><TeamExport teamId={focusedTeam.id} teamName={focusedTeam.name} /></div>
          {(() => {
            const userMembership = focusedTeam.members.find(
              (m) => m.userId === currentUser.id
            )
            const isTeamLead =
              !readOnly && (currentUser.role === 'ADMIN' || userMembership?.role === 'LEAD')
            const isMember = !readOnly && !!userMembership

            return (
              <TeamKanban
                team={focusedTeam}
                currentUser={readOnly ? { ...currentUser, role: 'OBSERVER' } : currentUser}
                viewerRole={currentUser.role}
                readOnly={readOnly}
                isTeamLead={isTeamLead}
                isMember={isMember}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}
