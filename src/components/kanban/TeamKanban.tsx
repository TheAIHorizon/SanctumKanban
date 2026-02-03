'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from './KanbanBoard'
import { ReflectionBoard } from '@/components/reflection/ReflectionBoard'
import { CreateTicketDialog } from './CreateTicketDialog'
import { Users, Plus, ChevronDown, ChevronUp, LayoutGrid, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

interface TeamKanbanProps {
  team: Team
  currentUser: CurrentUser
  isTeamLead: boolean
}

export function TeamKanban({ team, currentUser, isTeamLead }: TeamKanbanProps) {
  const [showMembers, setShowMembers] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [tickets, setTickets] = useState(team.tickets)

  const canCreateTickets = isTeamLead || currentUser.role === 'ADMIN'

  const handleTicketCreated = (newTicket: Ticket) => {
    setTickets((prev) => [...prev, newTicket])
  }

  const handleTicketUpdated = (updatedTicket: Ticket) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
    )
  }

  const handleTicketDeleted = (ticketId: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{team.name}</CardTitle>
            {team.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {team.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMembers(!showMembers)}
              className="text-muted-foreground"
            >
              <Users className="h-4 w-4 mr-1" />
              {team.members.length}
              {showMembers ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </Button>
            {canCreateTickets && (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Ticket
              </Button>
            )}
          </div>
        </div>

        {showMembers && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {team.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback
                    style={{ backgroundColor: member.user.color }}
                    className="text-white text-xs"
                  >
                    {getInitials(member.user.firstName, member.user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {member.user.firstName} {member.user.lastName}
                </span>
                {member.role === 'LEAD' && (
                  <span className="text-xs text-muted-foreground">(Lead)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        <Tabs defaultValue="kanban" className="h-full">
          <TabsList className="mb-4">
            <TabsTrigger value="kanban" className="flex items-center gap-1">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="reflection" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Reflection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-0">
            <KanbanBoard
              teamId={team.id}
              tickets={tickets}
              members={team.members}
              currentUser={currentUser}
              isTeamLead={isTeamLead}
              onTicketUpdated={handleTicketUpdated}
              onTicketDeleted={handleTicketDeleted}
            />
          </TabsContent>

          <TabsContent value="reflection" className="mt-0">
            <ReflectionBoard
              teamId={team.id}
              reflection={team.reflections[0] || null}
              isTeamLead={isTeamLead}
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        teamId={team.id}
        members={team.members}
        onTicketCreated={handleTicketCreated}
      />
    </Card>
  )
}
