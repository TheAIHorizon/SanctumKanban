'use client'

import { useDroppable } from '@dnd-kit/core'
import { TicketCard } from './TicketCard'
import { cn } from '@/lib/utils'

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
  description: string | null
  status: 'BACKLOG' | 'DOING' | 'DONE'
  position: number
  assignee: User | null
  teamId: string
}

interface CurrentUser {
  id: string
  role: string
}

interface KanbanColumnProps {
  id: string
  title: string
  color: string
  tickets: Ticket[]
  members: TeamMember[]
  currentUser: CurrentUser
  isTeamLead: boolean
  compactView?: boolean
  onTicketUpdated: (ticket: Ticket) => void
  onTicketDeleted: (ticketId: string) => void
}

export function KanbanColumn({
  id,
  title,
  color,
  tickets,
  members,
  currentUser,
  isTeamLead,
  compactView = true,
  onTicketUpdated,
  onTicketDeleted,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'kanban-column transition-colors',
        isOver && 'bg-muted ring-2 ring-primary/20'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-3 h-3 rounded-full', color)} />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
          {tickets.length}
        </span>
      </div>

      <div className="space-y-2 min-h-[100px]">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            members={members}
            currentUser={currentUser}
            isTeamLead={isTeamLead}
            compactView={compactView}
            onTicketUpdated={onTicketUpdated}
            onTicketDeleted={onTicketDeleted}
          />
        ))}

        {tickets.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-4">
            Drop tickets here
          </div>
        )}
      </div>
    </div>
  )
}
