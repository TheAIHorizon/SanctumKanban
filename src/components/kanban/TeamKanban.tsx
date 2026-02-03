'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from './KanbanBoard'
import { ReflectionBoard } from '@/components/reflection/ReflectionBoard'
import { CreateTicketDialog } from './CreateTicketDialog'
import { FilterBar, FilterState, defaultFilters } from './FilterBar'
import { Users, Plus, ChevronDown, ChevronUp, LayoutGrid, MessageSquare, Minimize2, Maximize2, Keyboard } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KeyboardShortcutsHelp } from '@/components/keyboard/KeyboardShortcutsHelp'

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
  tags?: Tag[]
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
  const [compactView, setCompactView] = useState(true) // Default to compact
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const canCreateTickets = isTeamLead || currentUser.role === 'ADMIN'

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Escape always works
      if (e.key === 'Escape') {
        setCreateDialogOpen(false)
        setShortcutsHelpOpen(false)
        // Clear search
        if (filters.search) {
          setFilters((prev) => ({ ...prev, search: '' }))
        }
        return
      }

      // Other shortcuts don't work in inputs
      if (isInput) return

      switch (e.key.toLowerCase()) {
        case 'n':
          if (canCreateTickets) {
            e.preventDefault()
            setCreateDialogOpen(true)
          }
          break
        case '?':
          e.preventDefault()
          setShortcutsHelpOpen(true)
          break
        case '/':
          e.preventDefault()
          // Focus the search input in FilterBar
          const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement
          searchInput?.focus()
          break
        case 'm':
          e.preventDefault()
          setFilters((prev) => ({ ...prev, myTicketsOnly: !prev.myTicketsOnly }))
          break
        case 'e':
          e.preventDefault()
          setCompactView((prev) => !prev)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canCreateTickets, filters.search])

  // Filter tickets based on current filters
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const titleMatch = ticket.title.toLowerCase().includes(searchLower)
        const descMatch = ticket.description?.toLowerCase().includes(searchLower)
        if (!titleMatch && !descMatch) return false
      }

      // My tickets only
      if (filters.myTicketsOnly && ticket.assignee?.id !== currentUser.id) {
        return false
      }

      // Assignee filter
      if (filters.assigneeId) {
        if (filters.assigneeId === 'unassigned') {
          if (ticket.assignee) return false
        } else {
          if (ticket.assignee?.id !== filters.assigneeId) return false
        }
      }

      // Tags filter (ticket must have at least one of the selected tags)
      if (filters.tagIds.length > 0) {
        const ticketTagIds = ticket.tags?.map((t) => t.tag.id) || []
        const hasMatchingTag = filters.tagIds.some((id) => ticketTagIds.includes(id))
        if (!hasMatchingTag) return false
      }

      return true
    })
  }, [tickets, filters, currentUser.id])

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
              onClick={() => setShortcutsHelpOpen(true)}
              className="text-muted-foreground"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompactView(!compactView)}
              className="text-muted-foreground"
              title={compactView ? 'Expand tickets (E)' : 'Compact view (E)'}
            >
              {compactView ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
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
              <Button size="sm" onClick={() => setCreateDialogOpen(true)} title="Add Ticket (N)">
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
            <FilterBar
              members={team.members}
              tags={team.tags || []}
              currentUserId={currentUser.id}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <KanbanBoard
              teamId={team.id}
              tickets={filteredTickets}
              members={team.members}
              tags={team.tags || []}
              currentUser={currentUser}
              isTeamLead={isTeamLead}
              compactView={compactView}
              hideColumns={filters.hideColumns}
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
        tags={team.tags || []}
        onTicketCreated={handleTicketCreated}
      />

      <KeyboardShortcutsHelp
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
      />
    </Card>
  )
}
