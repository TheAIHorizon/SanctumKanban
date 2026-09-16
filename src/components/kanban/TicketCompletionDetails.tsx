import React from 'react'

export function TicketCompletionDetails({ status, completedAt }: { status: string; completedAt?: Date | string | null }) {
  const date = completedAt ? new Date(completedAt) : null
  const recorded = date && Number.isFinite(date.getTime())
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Actual completion (automatic)</p>
      {recorded ? (
        <time dateTime={date.toISOString()}>
          {date.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC
        </time>
      ) : (
        <p className="text-muted-foreground">
          {status === 'DONE' ? 'Completion date not recorded' : 'Recorded automatically when this ticket moves to Done.'}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Reopening clears the current finish date; ticket history retains previous completions. Planned dates are unchanged.</p>
    </div>
  )
}
