'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { TicketCard } from './TicketCard'

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

interface Tag {
  id: string
  name: string
  color: string
}

interface Ticket {
  id: string
  title: string
  description: string | null
  status: 'BACKLOG' | 'DOING' | 'DONE'
  position: number
  dueDate?: string | null
  assignee: User | null
  teamId: string
  tags?: { tag: Tag }[]
  _count?: { comments: number }
}

interface CurrentUser {
  id: string
  role: string
}

interface HideColumns {
  BACKLOG: boolean
  DOING: boolean
  DONE: boolean
}

interface KanbanBoardProps {
  teamId: string
  tickets: Ticket[]
  members: TeamMember[]
  tags?: Tag[]
  currentUser: CurrentUser
  isTeamLead: boolean
  compactView?: boolean
  hideColumns?: HideColumns
  onTicketUpdated: (ticket: Ticket) => void
  onTicketDeleted: (ticketId: string) => void
}

const COLUMNS = [
  { id: 'BACKLOG', title: 'Backlog', color: 'bg-slate-500' },
  { id: 'DOING', title: 'Doing', color: 'bg-blue-500' },
  { id: 'DONE', title: 'Done', color: 'bg-green-500' },
] as const

const defaultHideColumns: HideColumns = {
  BACKLOG: false,
  DOING: false,
  DONE: false,
}

export function KanbanBoard({
  teamId,
  tickets,
  members,
  tags = [],
  currentUser,
  isTeamLead,
  compactView = true,
  hideColumns = defaultHideColumns,
  onTicketUpdated,
  onTicketDeleted,
}: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const canMoveTicket = (ticket: Ticket) => {
    if (currentUser.role === 'ADMIN' || isTeamLead) return true
    return ticket.assignee?.id === currentUser.id
  }

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id)
    if (ticket && canMoveTicket(ticket)) {
      setActiveTicket(ticket)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTicket(null)

    if (!over) return

    const ticketId = active.id as string
    const newStatus = over.id as 'BACKLOG' | 'DOING' | 'DONE'

    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    if (!canMoveTicket(ticket)) return

    // Optimistically update the UI
    const updatedTicket = { ...ticket, status: newStatus }
    onTicketUpdated(updatedTicket)

    // Update on the server
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        // Revert on error
        onTicketUpdated(ticket)
        console.error('Failed to update ticket')
      }
    } catch (error) {
      // Revert on error
      onTicketUpdated(ticket)
      console.error('Failed to update ticket:', error)
    }
  }

  const getTicketsForColumn = (status: string) => {
    return tickets
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position)
  }

  const visibleColumns = COLUMNS.filter((col) => !hideColumns[col.id])
  const gridCols = visibleColumns.length === 3 ? 'grid-cols-3' : visibleColumns.length === 2 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`grid ${gridCols} gap-4`}>
        {visibleColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            color={column.color}
            tickets={getTicketsForColumn(column.id)}
            members={members}
            tags={tags}
            currentUser={currentUser}
            isTeamLead={isTeamLead}
            compactView={compactView}
            onTicketUpdated={onTicketUpdated}
            onTicketDeleted={onTicketDeleted}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? (
          <TicketCard
            ticket={activeTicket}
            members={members}
            tags={tags}
            currentUser={currentUser}
            isTeamLead={isTeamLead}
            compactView={compactView}
            onTicketUpdated={onTicketUpdated}
            onTicketDeleted={onTicketDeleted}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
