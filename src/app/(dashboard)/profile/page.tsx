'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { getInitials, formatDateTime } from '@/lib/utils'
import { Loader2, Save, Eye, EyeOff, Activity } from 'lucide-react'

interface ActivityItem {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  timestamp: string
  ticket: {
    id: string
    title: string
    team: {
      id: string
      name: string
    }
  }
}

interface ActivityStats {
  ticketsCreated: number
  ticketsMoved: number
  ticketsCompleted: number
}

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const { toast } = useToast()
  const user = session?.user

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [color, setColor] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName)
      setLastName(user.lastName)
      setEmail(user.email)
      setColor(user.color)
      fetchActivity()
    }
  }, [user])

  const fetchActivity = async () => {
    if (!user) return
    
    try {
      const response = await fetch(`/api/users/${user.id}/activity`)
      if (response.ok) {
        const data = await response.json()
        setActivity(data.activity)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error)
    } finally {
      setLoadingActivity(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          contactInfo: contactInfo || null,
          color,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Profile updated',
          description: 'Your profile has been saved successfully.',
        })
        // Update session
        await update()
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save profile.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!user || !newPassword) return

    setSavingPassword(true)
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })

      if (response.ok) {
        toast({
          title: 'Password changed',
          description: 'Your password has been updated successfully.',
        })
        setCurrentPassword('')
        setNewPassword('')
      } else {
        throw new Error('Failed to change password')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to change password.',
        variant: 'destructive',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const getActionLabel = (action: string, fromStatus: string | null, toStatus: string | null) => {
    switch (action) {
      case 'created':
        return 'Created ticket'
      case 'moved':
        return `Moved from ${fromStatus} to ${toStatus}`
      case 'assigned':
        return 'Assigned'
      default:
        return action
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and view your activity
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile details and appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback
                    style={{ backgroundColor: color }}
                    className="text-white text-2xl"
                  >
                    {getInitials(firstName, lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="color">Profile Color</Label>
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
                      className="w-28"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Contact an admin to change your email address.
                </p>
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

              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
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

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword}
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.ticketsCreated}</div>
                    <p className="text-sm text-muted-foreground">Tickets Created</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.ticketsMoved}</div>
                    <p className="text-sm text-muted-foreground">Tickets Moved</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.ticketsCompleted}
                    </div>
                    <p className="text-sm text-muted-foreground">Tickets Completed</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingActivity ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activity.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No activity yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.ticket.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {getActionLabel(item.action, item.fromStatus, item.toStatus)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.ticket.team.name} • {formatDateTime(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
