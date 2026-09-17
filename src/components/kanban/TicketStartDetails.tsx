import React from 'react'
import { getGanttStart } from '@/lib/gantt-start'

export interface TicketStartDetailsProps {
  startedAt?: Date | string | null
  startDate?: Date | string | null
  startDateAutoFilled?: boolean
}

export function TicketStartDetails(props: TicketStartDetailsProps) {
  const start = getGanttStart(props)

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Actual start</p>
      {props.startedAt ? (
        <>
          <p className="mt-1 font-mono text-xs">{new Date(props.startedAt).toISOString()} (UTC)</p>
          {start.label && <p className="mt-1 text-xs text-muted-foreground">{start.label}</p>}
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Recorded automatically the first time this ticket enters Doing.
        </p>
      )}
    </div>
  )
}
