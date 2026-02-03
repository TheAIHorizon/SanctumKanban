'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Tag {
  id: string
  name: string
  color: string
  teamId: string | null
}

interface Team {
  id: string
  name: string
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#6b7280', // gray
]

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTag, setNewTag] = useState({ name: '', color: COLORS[0], teamId: 'global' })
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tagsRes, teamsRes] = await Promise.all([
        fetch('/api/tags'),
        fetch('/api/teams'),
      ])

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json()
        setTags(tagsData)
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json()
        setTeams(teamsData)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTag.name.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTag.name.trim(),
          color: newTag.color,
          teamId: newTag.teamId === 'global' ? null : newTag.teamId,
        }),
      })

      if (response.ok) {
        const tag = await response.json()
        setTags(prev => [...prev, tag])
        setNewTag({ name: '', color: COLORS[0], teamId: 'global' })
        toast({ title: 'Tag created successfully' })
      } else {
        const data = await response.json()
        toast({ title: 'Failed to create tag', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to create tag', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTags(prev => prev.filter(t => t.id !== tagId))
        toast({ title: 'Tag deleted successfully' })
      }
    } catch (error) {
      toast({ title: 'Failed to delete tag', variant: 'destructive' })
    }
  }

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return 'Global'
    const team = teams.find(t => t.id === teamId)
    return team?.name || 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tags</h1>
        <p className="text-muted-foreground">
          Create and manage tags for categorizing tickets
        </p>
      </div>

      {/* Create Tag Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Tag</CardTitle>
          <CardDescription>
            Create a global tag or team-specific tag
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTag} className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={newTag.name}
                onChange={(e) => setNewTag(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Bug, Feature, Urgent"
                className="w-48"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-1 flex-wrap w-48">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTag(prev => ({ ...prev, color }))}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newTag.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag-team">Scope</Label>
              <Select
                value={newTag.teamId}
                onValueChange={(v) => setNewTag(prev => ({ ...prev, teamId: v }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (All Teams)</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={creating || !newTag.name.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Tag
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tags</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No tags created yet. Create your first tag above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: tag.color + '30',
                          color: tag.color,
                          border: `1px solid ${tag.color}`,
                        }}
                      >
                        {tag.name}
                      </span>
                    </TableCell>
                    <TableCell>{getTeamName(tag.teamId)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
