'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Megaphone, Pin } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  createdAt: Date | string
  author: {
    firstName: string
    lastName: string
  }
}

interface AnnouncementBannerProps {
  announcements: Announcement[]
}

export function AnnouncementBanner({ announcements }: AnnouncementBannerProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (announcements.length === 0) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
                Announcements
              </CardTitle>
              <span className="text-sm text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                {announcements.length}
              </span>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                {isOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-blue-100 dark:border-blue-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.pinned && (
                        <Pin className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      )}
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        {announcement.title}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Posted by {announcement.author.firstName} {announcement.author.lastName} on{' '}
                      {formatDateTime(announcement.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
