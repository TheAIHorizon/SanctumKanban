'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getInitials } from '@/lib/utils'
import { Plus, Pencil, Trash2, Users, UserPlus, Loader2 } from 'lucide-react'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  color: string
}

interface TeamMember {
  id: string
  userId: string
  role: string
  user: User
}

interface Team {
  id: string
  name: string
  description: string | null
  members: TeamMember[]
  _count: {
    tickets: number
  }
}

export default function TeamsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  
  // Team dialog
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Member dialog
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'LEAD' | 'MEMBER'>('MEMBER')

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data)
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
    fetchUsers()
  }, [])

  const handleCreateTeam = () => {
    setEditingTeam(null)
    setTeamName('')
    setTeamDescription('')
    setTeamDialogOpen(true)
  }

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team)
    setTeamName(team.name)
    setTeamDescription(team.description || '')
    setTeamDialogOpen(true)
  }

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return

    setSaving(true)
    try {
      const url = editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams'
      const method = editingTeam ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName,
          description: teamDescription || null,
        }),
      })

      if (response.ok) {
        toast({
          title: editingTeam ? 'Team updated' : 'Team created',
          description: 'The team has been saved successfully.',
        })
        setTeamDialogOpen(false)
        fetchTeams()
        // Refresh server-side data so dashboard updates
        router.refresh()
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save team.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTeam = async (team: Team) => {
    if (!window.confirm(`Are you sure you want to delete "${team.name}"? This will also delete all tickets in this team.`)) {
      return
    }

    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Team deleted',
          description: 'The team has been deleted.',
        })
        fetchTeams()
        // Refresh server-side data so dashboard updates
        router.refresh()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete team.',
        variant: 'destructive',
      })
    }
  }

  const handleAddMember = (team: Team) => {
    setSelectedTeam(team)
    setSelectedUserId('')
    setSelectedRole('MEMBER')
    setMemberDialogOpen(true)
  }

  const handleSaveMember = async () => {
    if (!selectedTeam || !selectedUserId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Member added',
          description: 'The team member has been added.',
        })
        setMemberDialogOpen(false)
        fetchTeams()
        router.refresh()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add member')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add member.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (team: Team, userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the team?')) {
      return
    }

    try {
      const response = await fetch(`/api/teams/${team.id}/members?userId=${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Member removed',
          description: 'The team member has been removed.',
        })
        fetchTeams()
        router.refresh()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member.',
        variant: 'destructive',
      })
    }
  }

  const getAvailableUsers = () => {
    if (!selectedTeam) return users
    const memberIds = selectedTeam.members.map((m) => m.userId)
    return users.filter((u) => !memberIds.includes(u.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground">
            Manage teams and their members
          </p>
        </div>
        <Button onClick={handleCreateTeam}>
          <Plus className="h-4 w-4 mr-2" />
          New Team
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              No teams yet. Create your first team!
            </CardContent>
          </Card>
        ) : (
          teams.map((team) => (
            <Card key={team.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    {team.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {team.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditTeam(team)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTeam(team)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {team.members.length} members
                  </span>
                  <span>{team._count.tickets} tickets</span>
                </div>

                <div className="space-y-2">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1"
                    >
                      <div className="flex items-center gap-2">
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
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            Lead
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveMember(team, member.userId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => handleAddMember(team)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Team Dialog */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? 'Edit Team' : 'New Team'}
            </DialogTitle>
            <DialogDescription>
              {editingTeam
                ? 'Update team details.'
                : 'Create a new team for your projects.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamDescription">Description</Label>
              <Textarea
                id="teamDescription"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTeamDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTeam} disabled={saving || !teamName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a member to {selectedTeam?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableUsers().map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: user.color }}
                        />
                        {user.firstName} {user.lastName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as 'LEAD' | 'MEMBER')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="LEAD">Team Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMember} disabled={saving || !selectedUserId}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
