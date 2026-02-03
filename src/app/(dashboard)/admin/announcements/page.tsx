'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/utils'
import { Plus, Pencil, Trash2, Pin, Loader2 } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  createdAt: string
  author: {
    firstName: string
    lastName: string
  }
}

export default function AnnouncementsPage() {
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements?includeOld=true&limit=50')
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data)
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const handleCreate = () => {
    setEditingId(null)
    setTitle('')
    setContent('')
    setPinned(false)
    setDialogOpen(true)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    setTitle(announcement.title)
    setContent(announcement.content)
    setPinned(announcement.pinned)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return

    setSaving(true)
    try {
      const url = editingId
        ? `/api/announcements/${editingId}`
        : '/api/announcements'
      const method = editingId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, pinned }),
      })

      if (response.ok) {
        toast({
          title: editingId ? 'Announcement updated' : 'Announcement created',
          description: 'The announcement has been saved successfully.',
        })
        setDialogOpen(false)
        fetchAnnouncements()
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save announcement.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return
    }

    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Announcement deleted',
          description: 'The announcement has been deleted.',
        })
        fetchAnnouncements()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete announcement.',
        variant: 'destructive',
      })
    }
  }

  const handleTogglePin = async (announcement: Announcement) => {
    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !announcement.pinned }),
      })

      if (response.ok) {
        fetchAnnouncements()
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
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
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">
            Manage announcements visible to all teams
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No announcements yet. Create your first one!
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {announcement.pinned && (
                      <Pin className="h-4 w-4 text-blue-500" />
                    )}
                    <CardTitle className="text-lg">
                      {announcement.title}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTogglePin(announcement)}
                      title={announcement.pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin
                        className={`h-4 w-4 ${
                          announcement.pinned
                            ? 'text-blue-500 fill-blue-500'
                            : ''
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(announcement)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {announcement.content}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  By {announcement.author.firstName} {announcement.author.lastName}{' '}
                  on {formatDateTime(announcement.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </DialogTitle>
            <DialogDescription>
              This announcement will be visible to all users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your announcement..."
                rows={5}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="pinned" className="cursor-pointer">
                Pin this announcement
              </Label>
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
              disabled={saving || !title.trim() || !content.trim()}
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
