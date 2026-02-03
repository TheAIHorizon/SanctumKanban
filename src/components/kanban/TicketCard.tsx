'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditTicketDialog } from './EditTicketDialog'
import { cn, getInitials } from '@/lib/utils'
import { MoreHorizontal, Pencil, Trash2, GripVertical } from 'lucide-react'

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

interface TicketCardProps {
  ticket: Ticket
  members: TeamMember[]
  currentUser: CurrentUser
  isTeamLead: boolean
  onTicketUpdated: (ticket: Ticket) => void
  onTicketDeleted: (ticketId: string) => void
  isDragging?: boolean
}

export function TicketCard({
  ticket,
  members,
  currentUser,
  isTeamLead,
  onTicketUpdated,
  onTicketDeleted,
  isDragging = false,
}: TicketCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const canEdit =
    currentUser.role === 'ADMIN' ||
    isTeamLead ||
    ticket.assignee?.id === currentUser.id

  const canDelete = currentUser.role === 'ADMIN' || isTeamLead

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: ticket.id,
    disabled: !canEdit,
  })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onTicketDeleted(ticket.id)
      } else {
        console.error('Failed to delete ticket')
      }
    } catch (error) {
      console.error('Failed to delete ticket:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'ticket-card group',
          isDragging && 'dragging opacity-50',
          !canEdit && 'cursor-default'
        )}
      >
        <div className="flex items-start gap-2">
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              className="mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium leading-tight">{ticket.title}</h4>
              {(canEdit || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {ticket.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {ticket.description}
              </p>
            )}

            {ticket.assignee && (
              <div className="flex items-center gap-2 mt-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback
                    style={{ backgroundColor: ticket.assignee.color }}
                    className="text-white text-[10px]"
                  >
                    {getInitials(
                      ticket.assignee.firstName,
                      ticket.assignee.lastName
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  {ticket.assignee.firstName} {ticket.assignee.lastName}
                </span>
              </div>
            )}
          </div>

          {ticket.assignee && (
            <div
              className="w-1 h-full absolute left-0 top-0 rounded-l-md"
              style={{ backgroundColor: ticket.assignee.color }}
            />
          )}
        </div>
      </div>

      <EditTicketDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        ticket={ticket}
        members={members}
        onTicketUpdated={onTicketUpdated}
      />
    </>
  )
}
