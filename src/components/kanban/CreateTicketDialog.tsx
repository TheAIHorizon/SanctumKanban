'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Bug, Lightbulb, CheckSquare, FileText, Zap } from 'lucide-react'

// Ticket templates
const TICKET_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank',
    icon: FileText,
    title: '',
    description: '',
    color: '#6b7280',
  },
  {
    id: 'bug',
    name: 'Bug',
    icon: Bug,
    title: '[Bug] ',
    description: '**Steps to reproduce:**\n1. \n2. \n3. \n\n**Expected behavior:**\n\n**Actual behavior:**\n',
    color: '#ef4444',
  },
  {
    id: 'feature',
    name: 'Feature',
    icon: Lightbulb,
    title: '[Feature] ',
    description: '**Problem:**\n\n**Proposed solution:**\n\n**Acceptance criteria:**\n- [ ] \n',
    color: '#8b5cf6',
  },
  {
    id: 'task',
    name: 'Task',
    icon: CheckSquare,
    title: '[Task] ',
    description: '**Objective:**\n\n**Steps:**\n- [ ] \n- [ ] \n',
    color: '#3b82f6',
  },
  {
    id: 'improvement',
    name: 'Improvement',
    icon: Zap,
    title: '[Improvement] ',
    description: '**Current state:**\n\n**Desired improvement:**\n\n**Benefits:**\n',
    color: '#f59e0b',
  },
]

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

interface Ticket {
  id: string
  title: string
  description: string | null
  status: 'BACKLOG' | 'DOING' | 'DONE'
  position: number
  dueDate?: string | null
  assignee: User | null
  teamId: string
  tags?: { tag: Tag }[]
}

interface CreateTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  members: TeamMember[]
  tags?: Tag[]
  onTicketCreated: (ticket: Ticket) => void
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  teamId,
  members,
  tags = [],
  onTicketCreated,
}: CreateTicketDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('blank')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const applyTemplate = (templateId: string) => {
    const template = TICKET_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setTitle(template.title)
      setDescription(template.description)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          teamId,
          assigneeId: assigneeId || null,
          status: 'BACKLOG',
          dueDate: dueDate || null,
          tagIds: selectedTagIds,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create ticket')
      }

      const newTicket = await response.json()
      onTicketCreated(newTicket)
      onOpenChange(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedTemplate('blank')
    setTitle('')
    setDescription('')
    setAssigneeId('')
    setDueDate('')
    setSelectedTagIds([])
    setError('')
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>
            Add a new task to the backlog. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Template</Label>
            <div className="flex flex-wrap gap-2">
              {TICKET_TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-all ${
                      selectedTemplate === template.id
                        ? 'ring-2 ring-offset-1 border-primary'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                    style={{
                      backgroundColor:
                        selectedTemplate === template.id
                          ? template.color + '20'
                          : 'transparent',
                    }}
                    disabled={loading}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color:
                          selectedTemplate === template.id
                            ? template.color
                            : 'currentColor',
                      }}
                    />
                    {template.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter ticket title"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.user.id} value={member.user.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: member.user.color }}
                        />
                        {member.user.firstName} {member.user.lastName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${
                      selectedTagIds.includes(tag.id)
                        ? 'ring-2 ring-offset-1'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: tag.color + '30',
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    disabled={loading}
                  >
                    {selectedTagIds.includes(tag.id) && '✓ '}
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
