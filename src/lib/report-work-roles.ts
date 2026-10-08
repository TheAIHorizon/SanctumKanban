/** Shared by the on-screen report and HTML export; no AI requests or external data. */
export interface ReportTaskLink {
  note: string | null
  ticket: { id: string; title: string; status: string; team: { name: string } | null } | null
  ksat: { ksatId: string; description: string; roles: { coreOrAdditional: string | null; workRole: { code: string; title: string; inScope: boolean } }[] }
}
export type WorkFocus = 'Technical' | 'Policy / governance' | 'Mixed technical and policy' | 'Other / unclassified'

// Descriptive indicators from task wording, not an official DCWF classification
// or a measure of technical difficulty, student ability, or grading quality.
export function taskFocus(description: string): WorkFocus {
  const technical = /\b(install\w*|configur\w*|deploy\w*|troubleshoot\w*|debug\w*|programming|software|hardware|network\w*|database\w*|server\w*|authentication|encrypt\w*|packet\w*|vulnerabilit\w*|penetration|backup\w*|recovery|interfaces|AI|machine learning)\b/i.test(description)
  const policy = /\b(polic\w*|governance|compliance|regulat\w*|legal|audit\w*|risk\w*|standards|requirements|strateg\w*|procurement|acquisition\w*|security controls|business processes|project scope)\b/i.test(description)
  return technical && policy ? 'Mixed technical and policy' : technical ? 'Technical' : policy ? 'Policy / governance' : 'Other / unclassified'
}
export function buildWorkRoleReport(links: ReportTaskLink[], inScopeOnly: boolean) {
  const roles = new Map<string, { code: string; title: string; tasks: Map<string, { id: string; description: string; mapping: string; focus: WorkFocus; tickets: Map<string, { id: string; title: string; status: string; team: string; notes: Set<string> }> }> }>()
  const uniqueTasks = new Map<string, WorkFocus>()
  const uniqueTickets = new Map<string, { status: string; hasNote: boolean }>()
  for (const link of links) {
    const mappings = link.ksat.roles.filter(r => !inScopeOnly || r.workRole.inScope)
    if (!mappings.length) continue
    const focus = taskFocus(link.ksat.description)
    uniqueTasks.set(link.ksat.ksatId, focus)
    if (link.ticket) {
      const previous = uniqueTickets.get(link.ticket.id)
      uniqueTickets.set(link.ticket.id, { status: link.ticket.status, hasNote: !!link.note?.trim() || !!previous?.hasNote })
    }
    for (const mapping of mappings) {
      const role = roles.get(mapping.workRole.code) || { code: mapping.workRole.code, title: mapping.workRole.title, tasks: new Map() }
      const task = role.tasks.get(link.ksat.ksatId) || { id: link.ksat.ksatId, description: link.ksat.description, mapping: mapping.coreOrAdditional || 'Unassigned', focus, tickets: new Map() }
      if (link.ticket) {
        const ticket = task.tickets.get(link.ticket.id) || { id: link.ticket.id, title: link.ticket.title, status: link.ticket.status, team: link.ticket.team?.name || '', notes: new Set<string>() }
        if (link.note?.trim()) ticket.notes.add(link.note.trim())
        task.tickets.set(ticket.id, ticket)
      }
      role.tasks.set(task.id, task); roles.set(role.code, role)
    }
  }
  const grouped = Array.from(roles.values()).map(role => {
    const tasks = Array.from(role.tasks.values()).map(task => ({ ...task, tickets: Array.from(task.tickets.values()).map(t => ({ ...t, notes: Array.from(t.notes) })) }))
      .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    return { code: role.code, title: role.title, taskCount: tasks.length, completedTaskCount: tasks.filter(t => t.tickets.some(ticket => ticket.status === 'DONE')).length, tasks }
  }).sort((a, b) => b.taskCount - a.taskCount || a.code.localeCompare(b.code))
  const focusOrder: WorkFocus[] = ['Technical', 'Policy / governance', 'Mixed technical and policy', 'Other / unclassified']
  return {
    roles: grouped,
    focus: focusOrder.map(label => ({ label, count: Array.from(uniqueTasks.values()).filter(f => f === label).length })),
    totalTasks: uniqueTasks.size,
    tickets: { total: uniqueTickets.size, done: Array.from(uniqueTickets.values()).filter(t => t.status === 'DONE').length, doing: Array.from(uniqueTickets.values()).filter(t => t.status === 'DOING').length, backlog: Array.from(uniqueTickets.values()).filter(t => t.status === 'BACKLOG').length, withNotes: Array.from(uniqueTickets.values()).filter(t => t.hasNote).length },
  }
}
export type WorkRoleReport = ReturnType<typeof buildWorkRoleReport>
export const WORK_REPORT_METHOD = 'Roles are ordered by distinct DCWF task count. A task counts once per role and may appear under several roles. Completed means at least one linked ticket is Done; other linked tickets may still be open. Technical/policy categories are wording-based indicators, not official DCWF categories or proficiency grades. Counts follow the Course roles only filter. Pentest findings and final-assessment results require separate evaluation.'
