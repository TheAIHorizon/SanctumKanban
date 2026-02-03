'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Search, X, Filter, User, Tag, Eye, EyeOff } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface TeamMember {
  id: string
  userId: string
  user: {
    id: string
    firstName: string
    lastName: string
    color: string
  }
}

interface Tag {
  id: string
  name: string
  color: string
}

export interface FilterState {
  search: string
  assigneeId: string | null
  tagIds: string[]
  myTicketsOnly: boolean
  hideColumns: {
    BACKLOG: boolean
    DOING: boolean
    DONE: boolean
  }
}

interface FilterBarProps {
  members: TeamMember[]
  tags: Tag[]
  currentUserId: string
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

export const defaultFilters: FilterState = {
  search: '',
  assigneeId: null,
  tagIds: [],
  myTicketsOnly: false,
  hideColumns: {
    BACKLOG: false,
    DOING: false,
    DONE: false,
  },
}

export function FilterBar({
  members,
  tags,
  currentUserId,
  filters,
  onFiltersChange,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount =
    (filters.assigneeId ? 1 : 0) +
    filters.tagIds.length +
    (filters.myTicketsOnly ? 1 : 0) +
    Object.values(filters.hideColumns).filter(Boolean).length

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const clearFilters = () => {
    onFiltersChange(defaultFilters)
  }

  const toggleTag = (tagId: string) => {
    const newTagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId]
    updateFilters({ tagIds: newTagIds })
  }

  const toggleColumn = (column: 'BACKLOG' | 'DOING' | 'DONE') => {
    updateFilters({
      hideColumns: {
        ...filters.hideColumns,
        [column]: !filters.hideColumns[column],
      },
    })
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets... (/)"
          value={filters.search}
          onChange={(e) => updateFilters({ search: e.target.value })}
          className="pl-8 h-9"
          data-search-input
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-7 w-7 p-0"
            onClick={() => updateFilters({ search: '' })}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* My Tickets Toggle */}
      <Button
        variant={filters.myTicketsOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => updateFilters({ myTicketsOnly: !filters.myTicketsOnly })}
        className="h-9"
      >
        <User className="h-4 w-4 mr-1" />
        My Tickets
      </Button>

      {/* Filters Popover */}
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-4">
            {/* Assignee Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Assignee
              </label>
              <Select
                value={filters.assigneeId || 'all'}
                onValueChange={(value) =>
                  updateFilters({ assigneeId: value === 'all' ? null : value })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
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

            {/* Tags Filter */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={filters.tagIds.includes(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      style={{
                        backgroundColor: filters.tagIds.includes(tag.id)
                          ? tag.color
                          : 'transparent',
                        borderColor: tag.color,
                        color: filters.tagIds.includes(tag.id) ? 'white' : tag.color,
                      }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Show/Hide Columns */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                Show Columns
              </label>
              <div className="space-y-2">
                {(['BACKLOG', 'DOING', 'DONE'] as const).map((column) => (
                  <div key={column} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${column}`}
                      checked={!filters.hideColumns[column]}
                      onCheckedChange={() => toggleColumn(column)}
                    />
                    <label
                      htmlFor={`col-${column}`}
                      className="text-sm cursor-pointer"
                    >
                      {column.charAt(0) + column.slice(1).toLowerCase()}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Display */}
      {(filters.assigneeId || filters.tagIds.length > 0) && (
        <div className="flex items-center gap-1">
          {filters.assigneeId && (
            <Badge variant="secondary" className="h-6">
              {filters.assigneeId === 'unassigned'
                ? 'Unassigned'
                : members.find((m) => m.userId === filters.assigneeId)?.user
                    .firstName || 'Unknown'}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilters({ assigneeId: null })}
              />
            </Badge>
          )}
          {filters.tagIds.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId)
            return tag ? (
              <Badge
                key={tagId}
                variant="secondary"
                className="h-6"
                style={{ backgroundColor: tag.color, color: 'white' }}
              >
                {tag.name}
                <X
                  className="h-3 w-3 ml-1 cursor-pointer"
                  onClick={() => toggleTag(tagId)}
                />
              </Badge>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
