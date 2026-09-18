'use client'

import { EditTicketDialog } from '@/components/kanban/EditTicketDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { canEditGanttTicket } from '@/lib/gantt'
import type { GanttTeam, GanttTicket } from '@/components/dashboard/GanttView'

export function FeedbackTicketDialog({ ticketId, team, currentUser, readOnly, onClose, onUpdated }: {
  ticketId: string
  team: GanttTeam
  currentUser: { id: string; role: string }
  readOnly: boolean
  onClose: () => void
  onUpdated: (ticket: GanttTicket) => void
}) {
  const ticket = team.tickets.find(item => item.id === ticketId)
  if (ticket && canEditGanttTicket(team, ticket, currentUser, readOnly)) return (
    <EditTicketDialog open onOpenChange={open => { if (!open) onClose() }} ticket={ticket}
      members={team.members.map(member => ({ ...member, id: member.id || member.userId }))}
      tags={team.tags || []} onTicketUpdated={onUpdated} />
  )
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{ticket?.title || 'Linked ticket'}</DialogTitle>
          <DialogDescription>Read-only ticket reference from instructor feedback.</DialogDescription>
        </DialogHeader>
        {ticket ? <><p className="text-sm">Status: {ticket.status}</p><p className="whitespace-pre-wrap text-sm">{ticket.description || 'No description.'}</p></> :
          <p>This ticket is archived or no longer available on this active board. The feedback reference is preserved.</p>}
      </DialogContent>
    </Dialog>
  )
}
