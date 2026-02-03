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
import { MoreHorizontal, Pencil, Trash2, GripVertical, ChevronDown, ChevronUp, Calendar, MessageCircle } from 'lucide-react'

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

interface TicketTag {
  tag: Tag
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
  tags?: TicketTag[]
  _count?: { comments: number }
}

interface CurrentUser {
  id: string
  role: string
}

interface TicketCardProps {
  ticket: Ticket
  members: TeamMember[]
  tags?: Tag[]
  currentUser: CurrentUser
  isTeamLead: boolean
  compactView?: boolean
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
  tags,
  currentUser,
  isTeamLead,
  compactView = true,
  onTicketUpdated,
  onTicketDeleted,
  isDragging = false,
}: TicketCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Show expanded view if not in compact mode OR if user expanded this card
  const showExpanded = !compactView || isExpanded

  // Check if due date is overdue or soon
  const getDueDateStatus = () => {
    if (!ticket.dueDate) return null
    const due = new Date(ticket.dueDate)
    const now = new Date()
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'overdue'
    if (diffDays <= 2) return 'soon'
    return 'ok'
  }

  const dueDateStatus = getDueDateStatus()
  const commentCount = ticket._count?.comments || 0
  const ticketTags = ticket.tags?.map(t => t.tag) || []

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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on dropdown or drag handle
    if ((e.target as HTMLElement).closest('button, [data-drag-handle]')) {
      return
    }
    if (compactView) {
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={cardStyle}
        onClick={handleCardClick}
        className={cn(
          'rounded-md shadow-sm group transition-all',
          compactView ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
          'hover:shadow-md',
          !showExpanded && 'hover:scale-[1.01]',
          showExpanded && 'hover:scale-[1.02]',
          isDragging && 'opacity-50 rotate-3 shadow-lg',
          !canEdit && 'cursor-default',
          showExpanded ? 'p-3' : 'px-3 py-2'
        )}
      >
        <div className="flex items-start gap-2">
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              data-drag-handle
              className={cn(
                "cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-70 transition-opacity",
                showExpanded ? "mt-0.5" : "mt-0",
                isLightText ? "text-white/70" : "text-black/50"
              )}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  "font-semibold leading-tight",
                  showExpanded ? "text-sm" : "text-xs truncate"
                )}>
                  {ticket.title}
                </h4>
                {!showExpanded && (
                  <div className="flex items-center gap-2">
                    {ticket.assignee && (
                      <span className={cn(
                        "text-[10px]",
                        isLightText ? "text-white/70" : "text-black/60"
                      )}>
                        {ticket.assignee.firstName} {ticket.assignee.lastName[0]}.
                      </span>
                    )}
                    {dueDateStatus === 'overdue' && (
                      <Calendar className="h-3 w-3 text-red-500" />
                    )}
                    {dueDateStatus === 'soon' && (
                      <Calendar className="h-3 w-3 text-amber-500" />
                    )}
                    {commentCount > 0 && (
                      <span className={cn(
                        "text-[10px] flex items-center gap-0.5",
                        isLightText ? "text-white/70" : "text-black/60"
                      )}>
                        <MessageCircle className="h-2.5 w-2.5" />
                        {commentCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {compactView && (ticket.description || ticket.assignee) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(!isExpanded)
                    }}
                    className={cn(
                      "h-5 w-5 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity",
                      isLightText ? "hover:bg-white/20" : "hover:bg-black/10"
                    )}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
                {(canEdit || canDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity",
                          isLightText ? "hover:bg-white/20 text-white" : "hover:bg-black/10 text-black"
                        )}
                      >
                        <MoreHorizontal className="h-3 w-3" />
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
            </div>

            {showExpanded && (
              <>
                {ticket.description && (
                  <p className={cn(
                    "text-xs mt-1 line-clamp-2",
                    isLightText ? "text-white/80" : "text-black/70"
                  )}>
                    {ticket.description}
                  </p>
                )}

                {/* Tags */}
                {ticketTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ticketTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ 
                          backgroundColor: tag.color + '40', 
                          color: isLightText ? '#ffffff' : tag.color,
                          border: `1px solid ${tag.color}80`
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Due date and comment count */}
                <div className="flex items-center gap-3 mt-2">
                  {ticket.dueDate && (
                    <span className={cn(
                      "text-[10px] flex items-center gap-1",
                      dueDateStatus === 'overdue' && "text-red-500 font-semibold",
                      dueDateStatus === 'soon' && "text-amber-500 font-semibold",
                      dueDateStatus === 'ok' && (isLightText ? "text-white/70" : "text-black/60")
                    )}>
                      <Calendar className="h-3 w-3" />
                      {new Date(ticket.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {commentCount > 0 && (
                    <span className={cn(
                      "text-[10px] flex items-center gap-1",
                      isLightText ? "text-white/70" : "text-black/60"
                    )}>
                      <MessageCircle className="h-3 w-3" />
                      {commentCount}
                    </span>
                  )}
                </div>

                <p className={cn(
                  "text-xs font-medium mt-2",
                  isLightText ? "text-white/90" : "text-black/80"
                )}>
                  {ticket.assignee 
                    ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                    : 'Unassigned'
                  }
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <EditTicketDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        ticket={ticket}
        members={members}
        tags={tags}
        onTicketUpdated={onTicketUpdated}
      />
    </>
  )
}
