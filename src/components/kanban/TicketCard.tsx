'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditTicketDialog } from './EditTicketDialog'
import { cn } from '@/lib/utils'
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

// Convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

// Determine if text should be light or dark based on background
function getContrastColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor)
  if (!rgb) return '#000000'
  
  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
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

  // Get the card background color and text color
  const cardColor = ticket.assignee?.color || '#e5e7eb' // Gray for unassigned
  const textColor = getContrastColor(cardColor)
  const isLightText = textColor === '#ffffff'

  const cardStyle = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    backgroundColor: cardColor,
    color: textColor,
  }

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
        style={cardStyle}
        className={cn(
          'rounded-md p-3 shadow-sm cursor-grab active:cursor-grabbing group transition-all',
          'hover:shadow-md hover:scale-[1.02]',
          isDragging && 'opacity-50 rotate-3 shadow-lg',
          !canEdit && 'cursor-default'
        )}
      >
        <div className="flex items-start gap-2">
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              className={cn(
                "mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-70 transition-opacity",
                isLightText ? "text-white/70" : "text-black/50"
              )}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold leading-tight">{ticket.title}</h4>
              {(canEdit || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                        isLightText ? "hover:bg-white/20 text-white" : "hover:bg-black/10 text-black"
                      )}
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
              <p className={cn(
                "text-xs mt-1 line-clamp-2",
                isLightText ? "text-white/80" : "text-black/70"
              )}>
                {ticket.description}
              </p>
            )}

            <p className={cn(
              "text-xs font-medium mt-2",
              isLightText ? "text-white/90" : "text-black/80"
            )}>
              {ticket.assignee 
                ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                : 'Unassigned'
              }
            </p>
          </div>
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
