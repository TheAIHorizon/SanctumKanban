'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { getInitials, formatDate } from '@/lib/utils'
import { classLabel, directoryClasses, directoryTeams, selectDirectoryUsers, NO_CLASS, type DirectoryClass, type UserSortColumn, type SortDirection } from '@/lib/user-directory'
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface TeamMembership {
  team: {
    id: string
    name: string
    classWorkspaceId: string | null
  }
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  contactInfo: string | null
  role: 'ADMIN' | 'TEAM_LEAD' | 'MEMBER'
  color: string
  createdAt: string
  classMemberships: { classWorkspace: DirectoryClass }[]
  teamMemberships: TeamMembership[]
}

export default function UsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [classes, setClasses] = useState<DirectoryClass[]>([])
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [column, setColumn] = useState<UserSortColumn>('name')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [loadError, setLoadError] = useState('')
  const visibleUsers = useMemo(() => selectDirectoryUsers(users, { classId, search, column, direction }), [users, classId, search, column, direction])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'TEAM_LEAD' | 'MEMBER'>('MEMBER')
  const [color, setColor] = useState('#3b82f6')

  const fetchUsers = async () => {
    setLoadError('')
    try {
      const responses = await Promise.all([fetch('/api/users'), fetch('/api/classes'), fetch('/api/classes?archived=true')])
      if (responses.some(response => !response.ok)) throw new Error('Could not load the user directory. Please retry.')
      const [data, active, archived] = await Promise.all(responses.map(response => response.json()))
      setUsers(data)
      setClasses([...active, ...archived].sort((a, b) => classLabel(a).localeCompare(classLabel(b), 'en', { numeric: true, sensitivity: 'base' })))
    } catch {
      setLoadError('Could not load the user directory. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = () => {
    setEditingUser(null)
    setEmail('')
    setPassword('')
    setFirstName('')
    setLastName('')
    setContactInfo('')
    setRole('MEMBER')
    setColor('#3b82f6')
    setDialogOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEmail(user.email)
    setPassword('')
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setContactInfo(user.contactInfo || '')
    setRole(user.role)
    setColor(user.color)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return
    if (!editingUser && !password) return

    setSaving(true)
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PATCH' : 'POST'

      const body: any = {
        email,
        firstName,
        lastName,
        contactInfo: contactInfo || null,
        role,
        color,
      }

      if (password) {
        body.password = password
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast({
          title: editingUser ? 'User updated' : 'User created',
          description: 'The user has been saved successfully.',
        })
        setDialogOpen(false)
        fetchUsers()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save user.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete "${user.firstName} ${user.lastName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'User deleted',
          description: 'The user has been deleted.',
        })
        fetchUsers()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user.',
        variant: 'destructive',
      })
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
      case 'TEAM_LEAD':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const sortHeader = (key: UserSortColumn, label: string) => (
    <TableHead aria-sort={column === key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 py-3 whitespace-nowrap hover:text-foreground focus-visible:outline focus-visible:outline-2" title={key === 'name' ? 'Sort by last name, then first name' : `Sort by ${label.toLowerCase()}`} aria-label={`Sort by ${label}`} onClick={() => { setColumn(key); setDirection(column === key && direction === 'asc' ? 'desc' : 'asc') }}>
        {label}{column !== key ? <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5" /> : direction === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />}
      </button>
    </TableHead>
  )

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
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New User
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="user-class-filter">Class</Label>
          <select id="user-class-filter" value={classId} onChange={e => setClassId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">All classes / all users</option>
            <option value={NO_CLASS}>No class enrollment</option>
            <optgroup label="Active classes">{classes.filter(c => !c.archivedAt).map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</optgroup>
            <optgroup label="Archived classes">{classes.filter(c => c.archivedAt).map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</optgroup>
          </select>
        </div>
        <div className="space-y-1"><Label htmlFor="user-search">Search name or email</Label><Input id="user-search" type="search" placeholder="First name, last name, or email…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm text-muted-foreground">Showing {visibleUsers.length} of {users.length} users. Click a column heading to sort; click again to reverse. Name sorts by last name.</p>
        <Button variant="outline" size="sm" disabled={!classId && !search} onClick={() => { setClassId(''); setSearch('') }}>Clear filters</Button>
      </div>
      {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 text-destructive">{loadError}<Button variant="outline" onClick={fetchUsers}>Retry</Button></div>}

      <Card>
        <CardContent className="p-0">
          <Table aria-label="User directory">
            <TableHeader>
              <TableRow>
                {sortHeader('name', 'Name')}
                {sortHeader('email', 'Email')}
                {sortHeader('contact', 'Contact')}
                {sortHeader('role', 'Role')}
                {sortHeader('classes', 'Classes')}
                {sortHeader('teams', 'Teams')}
                {sortHeader('joined', 'Joined')}
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {loadError ? 'User directory unavailable.' : users.length === 0 ? 'No users found. Create your first user!' : 'No users match this class and search. Try another name or clear the filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            style={{ backgroundColor: user.color }}
                            className="text-white text-xs"
                          >
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.contactInfo || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeClass(
                          user.role
                        )}`}
                      >
                        {user.role.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {directoryClasses(user).length ? <div className="space-y-1 min-w-[150px]">{directoryClasses(user).map(course => <p key={course.id} className="text-xs">{classLabel(course)}</p>)}</div> : <span className="text-muted-foreground">No class enrollment</span>}
                    </TableCell>
                    <TableCell>
                      {directoryTeams(user, classId).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {directoryTeams(user, classId).slice(0, 2).map((tm) => (
                            <span
                              key={tm.team.id}
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              {tm.team.name}
                            </span>
                          ))}
                          {directoryTeams(user, classId).length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{directoryTeams(user, classId).length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${user.firstName} ${user.lastName}`}
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${user.firstName} ${user.lastName}`}
                          onClick={() => handleDelete(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update user details. Leave password blank to keep current.'
                : 'Create a new user account.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editingUser ? '(leave blank to keep current)' : '*'}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactInfo">Contact Info</Label>
              <Input
                id="contactInfo"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Phone, Slack, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !email.trim() ||
                !firstName.trim() ||
                !lastName.trim() ||
                (!editingUser && !password)
              }
            >
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
    </div>
  )
}
