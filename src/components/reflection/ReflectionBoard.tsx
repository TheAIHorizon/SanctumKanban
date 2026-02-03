'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, getWeekStart } from '@/lib/utils'
import { Save, Loader2, ThumbsUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Reflection {
  id: string
  wentWell: string | null
  couldImprove: string | null
  actionItems: string | null
  weekOf: Date | string
}

interface ReflectionBoardProps {
  teamId: string
  reflection: Reflection | null
  isTeamLead: boolean
}

export function ReflectionBoard({
  teamId,
  reflection,
  isTeamLead,
}: ReflectionBoardProps) {
  const { toast } = useToast()
  const weekStart = getWeekStart()
  
  const [wentWell, setWentWell] = useState(reflection?.wentWell || '')
  const [couldImprove, setCouldImprove] = useState(reflection?.couldImprove || '')
  const [actionItems, setActionItems] = useState(reflection?.actionItems || '')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleChange = (
    field: 'wentWell' | 'couldImprove' | 'actionItems',
    value: string
  ) => {
    setHasChanges(true)
    switch (field) {
      case 'wentWell':
        setWentWell(value)
        break
      case 'couldImprove':
        setCouldImprove(value)
        break
      case 'actionItems':
        setActionItems(value)
        break
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          wentWell: wentWell || null,
          couldImprove: couldImprove || null,
          actionItems: actionItems || null,
          weekOf: weekStart,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save reflection')
      }

      setHasChanges(false)
      toast({
        title: 'Reflection saved',
        description: 'Your team reflection has been saved successfully.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save reflection. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const isCurrentWeek =
    reflection?.weekOf &&
    new Date(reflection.weekOf).getTime() === weekStart.getTime()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Week of {formatDate(weekStart)}
        </p>
        {isTeamLead && hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Went Well */}
        <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
              <ThumbsUp className="h-4 w-4" />
              What Went Well
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isTeamLead ? (
              <Textarea
                value={wentWell}
                onChange={(e) => handleChange('wentWell', e.target.value)}
                placeholder="List successes and wins..."
                className="min-h-[120px] bg-white dark:bg-slate-900 border-green-200 dark:border-green-900"
              />
            ) : (
              <div className="min-h-[120px] p-3 bg-white dark:bg-slate-900 rounded-md border border-green-200 dark:border-green-900 text-sm whitespace-pre-wrap">
                {wentWell || (
                  <span className="text-muted-foreground italic">
                    No entries yet
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Could Improve */}
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Could Improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isTeamLead ? (
              <Textarea
                value={couldImprove}
                onChange={(e) => handleChange('couldImprove', e.target.value)}
                placeholder="What could be better..."
                className="min-h-[120px] bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900"
              />
            ) : (
              <div className="min-h-[120px] p-3 bg-white dark:bg-slate-900 rounded-md border border-amber-200 dark:border-amber-900 text-sm whitespace-pre-wrap">
                {couldImprove || (
                  <span className="text-muted-foreground italic">
                    No entries yet
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-4 w-4" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isTeamLead ? (
              <Textarea
                value={actionItems}
                onChange={(e) => handleChange('actionItems', e.target.value)}
                placeholder="Actions to take next week..."
                className="min-h-[120px] bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900"
              />
            ) : (
              <div className="min-h-[120px] p-3 bg-white dark:bg-slate-900 rounded-md border border-blue-200 dark:border-blue-900 text-sm whitespace-pre-wrap">
                {actionItems || (
                  <span className="text-muted-foreground italic">
                    No entries yet
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
