'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Users } from 'lucide-react'

interface User {
  id: string
  firstName: string
  lastName: string
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
  status: 'BACKLOG' | 'DOING' | 'DONE'
  assignee: User | null
}

interface Team {
  id: string
  name: string
  description: string | null
  members: TeamMember[]
  tickets: Ticket[]
}

interface HeatMapViewProps {
  teams: Team[]
  onTeamClick?: (teamId: string) => void
}

const COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'DOING', label: 'Doing', color: 'bg-blue-400' },
  { id: 'DONE', label: 'Done', color: 'bg-green-400' },
] as const

export function HeatMapView({ teams, onTeamClick }: HeatMapViewProps) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {teams.map((team) => (
          <HeatMapCard
            key={team.id}
            team={team}
            onClick={() => onTeamClick?.(team.id)}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}

interface HeatMapCardProps {
  team: Team
  onClick?: () => void
}

function HeatMapCard({ team, onClick }: HeatMapCardProps) {
  const ticketsByStatus = {
    BACKLOG: team.tickets.filter((t) => t.status === 'BACKLOG'),
    DOING: team.tickets.filter((t) => t.status === 'DOING'),
    DONE: team.tickets.filter((t) => t.status === 'DONE'),
  }

  const totalTickets = team.tickets.length

  // Calculate participation stats
  const assignedTickets = team.tickets.filter((t) => t.assignee)
  const participationByMember = team.members.map((member) => {
    const memberTickets = team.tickets.filter(
      (t) => t.assignee?.id === member.userId
    )
    return {
      member,
      count: memberTickets.length,
      percentage: totalTickets > 0 ? (memberTickets.length / totalTickets) * 100 : 0,
    }
  })

  // Find imbalances
  const hasTickets = totalTickets > 0
  const backlogHeavy =
    hasTickets && ticketsByStatus.BACKLOG.length > totalTickets * 0.6
  const doneHeavy =
    hasTickets && ticketsByStatus.DONE.length > totalTickets * 0.6
  const hasIdleMembers =
    hasTickets &&
    participationByMember.some((p) => p.count === 0) &&
    team.members.length > 1

  // Determine health indicator
  let healthColor = 'bg-green-500' // Good
  let healthLabel = 'Healthy'
  if (backlogHeavy) {
    healthColor = 'bg-amber-500'
    healthLabel = 'Backlogged'
  }
  if (hasIdleMembers && backlogHeavy) {
    healthColor = 'bg-red-500'
    healthLabel = 'Needs attention'
  }
  if (totalTickets === 0) {
    healthColor = 'bg-slate-400'
    healthLabel = 'No tickets'
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow hover:ring-2 hover:ring-primary/50"
      onClick={onClick}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate">
            {team.name}
          </CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <div className={`w-2 h-2 rounded-full ${healthColor}`} />
            </TooltipTrigger>
            <TooltipContent>{healthLabel}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {team.members.length}
          <span className="mx-1">•</span>
          {totalTickets} tickets
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {/* Mini Kanban Grid */}
        <div className="grid grid-cols-3 gap-1 mb-3">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground text-center truncate">
                {col.label}
              </div>
              <div className="min-h-[60px] bg-muted/30 rounded p-1 flex flex-wrap content-start gap-0.5">
                {ticketsByStatus[col.id].map((ticket) => (
                  <Tooltip key={ticket.id}>
                    <TooltipTrigger asChild>
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: ticket.assignee?.color || '#9ca3af',
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <div className="font-medium">{ticket.title}</div>
                        <div className="text-muted-foreground">
                          {ticket.assignee
                            ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                            : 'Unassigned'}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div className="text-[10px] text-center text-muted-foreground">
                {ticketsByStatus[col.id].length}
              </div>
            </div>
          ))}
        </div>

        {/* Participation Bar */}
        {hasTickets && (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">
              Participation
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              {participationByMember
                .filter((p) => p.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((p) => (
                  <Tooltip key={p.member.userId}>
                    <TooltipTrigger asChild>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${p.percentage}%`,
                          backgroundColor: p.member.user.color,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {p.member.user.firstName} {p.member.user.lastName}:{' '}
                      {p.count} tickets ({Math.round(p.percentage)}%)
                    </TooltipContent>
                  </Tooltip>
                ))}
            </div>
            {/* Member dots */}
            <div className="flex gap-1 flex-wrap">
              {participationByMember.map((p) => (
                <Tooltip key={p.member.userId}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        p.count === 0
                          ? 'border-dashed border-muted-foreground/50'
                          : 'border-transparent'
                      }`}
                      style={{
                        backgroundColor:
                          p.count > 0 ? p.member.user.color : 'transparent',
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.member.user.firstName} {p.member.user.lastName}
                    {p.count === 0 ? ' (no tickets)' : `: ${p.count} tickets`}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
