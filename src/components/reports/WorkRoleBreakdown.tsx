import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WORK_REPORT_METHOD, type WorkRoleReport } from '@/lib/report-work-roles'

export function WorkRoleBreakdown({ report }: { report: WorkRoleReport }) {
  return <section aria-label="Work roles and tasks" className="space-y-4">
    <h2 className="text-xl font-semibold">Work roles and tasks</h2>
    <p className="text-sm text-muted-foreground">Most tasks first. Includes DCWF links on assigned tickets and links recorded by this student.</p>
    <Card>
      <CardHeader><CardTitle className="text-base">Work focus and completion</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="grid gap-2 sm:grid-cols-2">{report.focus.map(f => <li key={f.label}><strong>{f.label}:</strong> {f.count} distinct tasks</li>)}</ul>
        <p>{report.tickets.total} linked tickets: <strong>{report.tickets.done} Done</strong>, {report.tickets.doing} Doing, {report.tickets.backlog} Backlog. {report.tickets.withNotes} have task notes; {report.tickets.total - report.tickets.withNotes} do not.</p>
        <p className="text-xs text-muted-foreground">{WORK_REPORT_METHOD}</p>
      </CardContent>
    </Card>
    {!report.roles.length && <p className="text-sm text-muted-foreground">No tasks match the selected role filter.</p>}
    {report.roles.map(role => <Card key={role.code}>
      <CardHeader className="pb-3"><CardTitle className="text-base">{role.code} {role.title} — {role.taskCount} tasks</CardTitle><p className="text-sm text-muted-foreground">{role.completedTaskCount} tasks with completed work</p></CardHeader>
      <CardContent><ol className="space-y-4">{role.tasks.map(task => <li key={task.id} className="rounded border p-3 space-y-2">
        <p className="text-sm"><strong>{task.id}</strong> — {task.description}</p>
        <p className="text-xs text-muted-foreground">{task.mapping} · {task.focus}</p>
        <ul className="space-y-2">{task.tickets.map(ticket => <li key={ticket.id} className="text-sm border-l-2 pl-3">
          <p className="font-medium">{ticket.title} · {ticket.status}</p><p className="text-xs text-muted-foreground">{ticket.team}</p>
          {ticket.notes.map(note => <p key={note} className="whitespace-pre-wrap text-muted-foreground">{note}</p>)}
        </li>)}</ul>
      </li>)}</ol></CardContent>
    </Card>)}
  </section>
}
