'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  buildVisibleTicketPositionUpdates,
  type TicketPositionUpdate,
} from '@/lib/ticket-reorder'
import { useToast } from '@/hooks/use-toast'
import { can, type Role } from '@/lib/permissions'

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
  startDate?: Date | string | null
  dueDate?: Date | string | null
  completedAt?: Date | string | null
  startedAt?: Date | string | null
  startDateAutoFilled?: boolean
  assignee: User | null
  createdById?: string | null
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

export interface KanbanBoardProps {
  teamId: string
  tickets: Ticket[]
  members: TeamMember[]
  tags?: Tag[]
  currentUser: CurrentUser
  isTeamLead: boolean
  canViewGuidance?: boolean
  compactView?: boolean
  hideColumns?: HideColumns
  onTicketUpdated: (ticket: Ticket) => void
  onTicketDeleted: (ticketId: string) => void
  /** Update the parent board's complete ticket list, including filtered-out tickets. */
  onTicketsReordered?: (positions: TicketPositionUpdate[]) => void
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
  canViewGuidance = false,
  compactView = true,
  hideColumns = defaultHideColumns,
  onTicketUpdated,
  onTicketDeleted,
  onTicketsReordered,
}: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const dragMutationInFlight = useRef(false)
  const router = useRouter()
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const canMoveTicket = (ticket: Ticket) => {
    return can({ id: currentUser.id, role: currentUser.role as Role }, 'ticket:update', {
      isMember: members.some((member) => member.userId === currentUser.id),
      isLead: isTeamLead,
      assigneeId: ticket.assignee?.id,
      createdById: ticket.createdById,
    })
  }

  const applyPositions = (positions: TicketPositionUpdate[]) => {
    if (onTicketsReordered) {
      onTicketsReordered(positions)
      return
    }

    // Compatibility fallback until TeamKanban wires the batch callback. It can
    // only update tickets currently visible to this filtered board.
    positions.forEach(({ id, position }) => {
      const visibleTicket = tickets.find((candidate) => candidate.id === id)
      if (visibleTicket) onTicketUpdated({ ...visibleTicket, position })
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (dragMutationInFlight.current) return
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
    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || !canMoveTicket(ticket)) return

    const targetTicket = tickets.find((candidate) => candidate.id === over.id)
    const newStatus = targetTicket?.status ?? (
      COLUMNS.some((column) => column.id === over.id)
        ? over.id as Ticket['status']
        : null
    )
    if (!newStatus) return

    if (ticket.status === newStatus) {
      if (!targetTicket || targetTicket.id === ticket.id) return
      if (dragMutationInFlight.current) return
      dragMutationInFlight.current = true

      const visibleColumnTickets = tickets
        .filter((candidate) => candidate.status === ticket.status)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      const originalPositions = visibleColumnTickets.map(({ id, position }) => ({ id, position }))
      const optimisticPositions = buildVisibleTicketPositionUpdates(
        visibleColumnTickets,
        ticket.id,
        targetTicket.id
      )
      applyPositions(optimisticPositions)

      try {
        const response = await fetch(`/api/tickets/${ticketId}/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetTicketId: targetTicket.id }),
        })
        if (!response.ok) throw new Error('Failed to reorder ticket')

        const result = await response.json()
        if (!Array.isArray(result.positions)) throw new Error('Invalid reorder response')
        applyPositions(result.positions)
      } catch (error) {
        applyPositions(originalPositions)
        router.refresh()
        toast({
          title: 'Ticket order was not saved',
          description: 'The previous order has been restored.',
          variant: 'destructive',
        })
        console.error('Failed to reorder ticket:', error)
      } finally {
        dragMutationInFlight.current = false
      }
      return
    }

    if (dragMutationInFlight.current) return
    dragMutationInFlight.current = true

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

      if (!response.ok) throw new Error('Failed to update ticket')
    } catch (error) {
      // Revert on error
      onTicketUpdated(ticket)
      router.refresh()
      console.error('Failed to update ticket:', error)
      toast({ title: 'Ticket move was not saved', variant: 'destructive' })
    } finally {
      dragMutationInFlight.current = false
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
            canViewGuidance={canViewGuidance}
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
            canViewGuidance={canViewGuidance}
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
