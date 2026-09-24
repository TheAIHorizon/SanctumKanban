export type HelpRole = 'ADMIN' | 'TEAM_LEAD' | 'MEMBER' | 'OBSERVER'
export type HelpAudience = 'authenticated' | 'admin'

export type HelpContentBlock =
  | { readonly type: 'paragraph'; readonly text: string }
  | { readonly type: 'bullets'; readonly items: readonly string[] }

export interface HelpSection {
  readonly heading: string
  readonly blocks: readonly HelpContentBlock[]
}

export interface HelpGuide {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly audience: HelpAudience
  readonly sections: readonly HelpSection[]
}

export const HELP_GUIDES = [
  {
    slug: 'requests-and-bugs',
    title: 'Feature requests and bug reports',
    description: 'Suggest improvements, report problems, and track staff responses.',
    audience: 'authenticated',
    sections: [
      { heading: 'Submit a post', blocks: [{ type: 'paragraph', text: 'Signed-in members, team leads, and staff can open Requests & bugs in the header. Choose Bug report or Feature request, enter a title and description, and submit. For a bug, include what you expected, what happened, and optional reproduction steps. Observers cannot submit or read posts.' }] },
      { heading: 'Track a response', blocks: [{ type: 'paragraph', text: 'My submissions lists your posts. Select one to see its status and staff response. Use type/status filters and Refresh submissions to check for updates. Posts are private to their submitter and staff; other students cannot read them. Do not include passwords, API keys, or private student information.' }] },
      { heading: 'Staff follow-up', blocks: [{ type: 'paragraph', text: 'Staff see All submissions and can change status to New, Planned, In progress, Resolved, or Closed, and save a response visible to the submitter. Original submitted text is retained. If another staff member changes the same post, refresh before saving again. Submissions remain available to staff if the author account is deleted.' }] },
    ],
  },
  {
    slug: 'exports-and-assessments',
    title: 'Team exports and practice tests',
    description: 'Print a team board or Gantt chart, and study with personalized tests.',
    audience: 'authenticated',
    sections: [
      { heading: 'Export one team', blocks: [
        { type: 'paragraph', text: 'Choose Export beside the team in Detailed, My Teams, a focused board, or Gantt. Select Detailed board or Gantt, an inclusive date range of up to 366 days, and landscape Letter or Tabloid paper. Print / Save PDF opens a standalone page; use its print button and select the same paper size in your browser dialog. Download HTML saves an offline copy.' },
        { type: 'paragraph', text: 'Exports include active tickets in that team, with dates overlapping the selected range. Unscheduled tickets use creation/update activity. On-screen search filters do not apply. Long charts split into date slices; a date appendix preserves full titles and recorded dates. Private feedback and individual reports are excluded.' },
      ] },
      { heading: 'Generate and take a practice test', blocks: [
        { type: 'paragraph', text: 'Open Practice tests, select your course and work dates, and generate a new version. A local worker builds 25 multiple-choice questions: five concepts, ten applications, and ten troubleshooting scenarios. You can leave and return while it works. An unchanged queued status means the operator may need to start the worker. Cancel generation if needed.' },
        { type: 'paragraph', text: 'The test uses your assigned Doing/Done tickets with activity in the range and your own dated DCWF notes, including archived work. Creating another student’s ticket does not count as doing it. Whole-team reflections are not attributed to one student. Thin evidence can prevent generation; document what you did and learned. Each version is saved and avoids exact question stems from the last five successful versions, while topics may recur.' },
      ] },
      { heading: 'Learn from your results', blocks: [
        { type: 'paragraph', text: 'Answer all 25 questions and submit once to see your score and explanations. Scores are study feedback, not course grades. AI can make mistakes; ask your instructor about disputed answers. Other students cannot read your tests. Archived courses retain saved tests but reject generation and submissions.' },
      ] },
    ],
  },
  {
    slug: 'instructor-exams',
    title: 'Instructor exam drafts',
    description: 'Generate, edit or accept a student-specific exam and print a separate answer key.',
    audience: 'admin',
    sections: [
      { heading: 'Prepare an exam', blocks: [
        { type: 'paragraph', text: 'In Assessments, choose a course, enrolled student, date range and Instructor exam draft. Optionally paste reference excerpts or expected procedures. Links are not fetched. The user-owned AI endpoint receives the selected evidence and supplied references to produce a new saved version. No ticket content is changed.' },
      ] },
      { heading: 'Edit or accept the default', blocks: [
        { type: 'paragraph', text: 'Inspect the evidence snapshot and question sources, edit any question, options, correct answer or explanation, and save your edits. You may also accept the generated default directly. Accept exam freezes that version and records whether it was edited or accepted unchanged. AI correctness is not guaranteed by acceptance.' },
      ] },
      { heading: 'Distribute the exam', blocks: [
        { type: 'paragraph', text: 'Print student exam contains only questions and choices. Print separate answer key includes correct choices and explanations. Keep the key separate when distributing the exam. Student accounts, including team leads, cannot access instructor drafts or their keys. Online graded-exam delivery is not included in this release; use the printed/exported exam in your existing assessment process.' },
      ] },
    ],
  },
  {
    slug: 'user-manual',
    title: 'User manual',
    description: 'Start with the dashboard, understand each role, and build a safe daily workflow.',
    audience: 'authenticated',
    sections: [
      {
        heading: 'Start at the Dashboard',
        blocks: [
          { type: 'paragraph', text: 'The Dashboard is the shared view of class work. Select a class you can access, then use Detailed, Overview, My Teams, or Gantt to choose the amount of context you need.' },
          { type: 'bullets', items: [
            'Detailed starts with every team collapsed, with your teams first. Expand teams individually, or use Expand all teams. Collapsing an opened team keeps its filters during that visit.',
            'Overview summarizes team activity and lets you focus one team without leaving the Dashboard.',
            'My Teams is based on recorded team membership and is not available to an Observer.',
          ] },
        ],
      },
      {
        heading: 'Know your role',
        blocks: [
          { type: 'paragraph', text: 'Your global role and current team membership determine what you can change. Seeing a board does not automatically grant permission to edit it.' },
          { type: 'bullets', items: [
            'ADMIN users manage classes and application-wide settings and can work across teams.',
            'TEAM_LEAD users manage work and weekly reflections in teams they lead but are not instructional staff.',
            'MEMBER users create work in their own team and edit tickets they created or that are assigned to them.',
            'OBSERVER users can browse active class boards but remain read only.',
          ] },
        ],
      },
      {
        heading: 'A safe working routine',
        blocks: [
          { type: 'paragraph', text: 'Refresh before a coordination session because the application does not promise live updates. Use tickets as a non-sensitive operating record, not as a secrets vault.' },
          { type: 'bullets', items: [
            'Confirm the class and team before creating or changing work.',
            'Keep each ticket focused on an observable outcome and record useful verification evidence.',
            'Review changes after saving, and manually reconcile any shared-note revision conflict.',
            'Archive completed work rather than destroying evidence needed for later reflection.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'tickets',
    title: 'Tickets and board workflow',
    description: 'Create, assign, move, verify, and discuss work without losing the team context.',
    audience: 'authenticated',
    sections: [
      {
        heading: 'Plan and assign work',
        blocks: [
          { type: 'paragraph', text: 'Create tickets on a team where you are a member. Add a clear title, a useful description, an optional assignee, tags, and dates that describe the plan.' },
          { type: 'bullets', items: [
            'Backlog is upcoming work, Doing is active work, and Done is verified work.',
            'Only current team members can be selected as an assignee when a ticket is created.',
            'Search and filters change only what is displayed; they do not remove or archive tickets.',
          ] },
        ],
      },
      {
        heading: 'Move, order, and complete',
        blocks: [
          { type: 'paragraph', text: 'Dragging between columns changes status. Dragging onto another ticket in the same column changes the saved priority order when your permissions allow it.' },
          { type: 'bullets', items: [
            'Moving into Doing for the first time records the actual start without replacing an existing planned start.',
            'Moving into Done records the actual completion time; reopening clears the current completion while preserving history.',
            'Filtered reordering keeps hidden tickets in a coherent full-column order, so clear filters and refresh when checking it.',
          ] },
        ],
      },
      {
        heading: 'Document and collaborate',
        blocks: [
          { type: 'paragraph', text: 'Use comments for durable handoffs and the DCWF tab for framework Tasks you actually performed. A concise first-person reflection should explain your contribution.' },
          { type: 'bullets', items: [
            'Do not place secrets, private keys, tokens, or restricted personal information in ticket text.',
            'Read-only viewers can inspect details but do not receive edit, comment, or drag controls.',
            'Archived classes preserve tickets and history while rejecting new changes.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'gantt',
    title: 'Gantt timeline',
    description: 'Understand planned dates, actual milestones, unscheduled work, and UTC date comparisons.',
    audience: 'authenticated',
    sections: [
      {
        heading: 'Planned schedule',
        blocks: [
          { type: 'paragraph', text: 'Gantt is another view of the same tickets, not a separate plan. A bar needs both a planned start date and a due date, and both calendar days are included.' },
          { type: 'bullets', items: [
            'A ticket missing either endpoint appears as Unscheduled with the missing-date reason.',
            'A dated ticket outside the selected week or month is counted outside the range rather than called Unscheduled.',
            'Creation time is never invented as a planned start, and this version does not drag or resize bars.',
          ] },
        ],
      },
      {
        heading: 'Actual start and finish',
        blocks: [
          { type: 'paragraph', text: 'The first move into Doing records actual start. Done records actual completion. Planned bars remain visible so the timeline can compare intent with the observed milestone.' },
          { type: 'bullets', items: [
            'An existing planned start is preserved and compared with the actual start.',
            'Late completion uses a finish marker and extension; unfinished overdue work remains visually distinct.',
            'Older Done tickets with an unknown completion timestamp remain labeled as not recorded instead of being backfilled.',
          ] },
        ],
      },
      {
        heading: 'Calendar interpretation',
        blocks: [
          { type: 'paragraph', text: 'Timeline comparisons use UTC calendar days so the same stored timestamp has a consistent date across viewers. Date-only values stay on their exact calendar day.' },
          { type: 'bullets', items: [
            'Use Week or Month plus Previous, Next, and Today to move through the timeline.',
            'A same-day planned start and due date produces a visible one-day bar.',
            'Refresh to see another user’s changes; the timeline does not provide live collaboration.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'ai-guidance',
    title: 'AI guidance',
    description: 'Use Laguna S coaching and saved nightly reviews as advisory, grounded assistance.',
    audience: 'authenticated',
    sections: [
      {
        heading: 'Manual AI Coach',
        blocks: [
          { type: 'paragraph', text: 'In an editable saved ticket, opening the AI Coach tab sends nothing. Select Ask AI Coach to request Laguna S guidance for the current title, description, and retrieved DCWF Task excerpts.' },
          { type: 'bullets', items: [
            'The coach can ask how work was tested and what observable result verified it.',
            'Changing the draft clears old advice so guidance from one draft is not mistaken for another.',
            'You decide whether to edit the ticket or deliberately link a suggested DCWF Task.',
          ] },
        ],
      },
      {
        heading: 'Saved nightly guidance',
        blocks: [
          { type: 'paragraph', text: 'When an ADMIN has enabled nightly review for a class, a separate scheduled process may review eligible saved tickets and store guidance for authorized team members.' },
          { type: 'bullets', items: [
            'Manual guidance is user-triggered, while nightly guidance is based on the saved ticket snapshot.',
            'Saved guidance is labeled as AI-generated or keyword fallback and may identify an older draft.',
            'A review never changes ticket text, status, dates, assignee, or DCWF links automatically.',
          ] },
        ],
      },
      {
        heading: 'Advisory boundaries',
        blocks: [
          { type: 'paragraph', text: 'Laguna S is an adviser, not a verifier and not a grade. Its suggestions can be incomplete, and official task wording comes only from eligible imported records.' },
          { type: 'bullets', items: [
            'Keyword fallback is clearly distinguished from a successful model response.',
            'No relevant result should lead to abstention or a request for clearer technical detail.',
            'Review every suggestion and keep personal information and secrets out of free-text tickets.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'team-collaboration',
    title: 'Team collaboration and privacy',
    description: 'Choose correctly between shared Team Notes and PRIVATE instructor feedback.',
    audience: 'authenticated',
    sections: [
      {
        heading: 'Shared Team Notes',
        blocks: [
          { type: 'paragraph', text: 'Team Notes are a shared coordination space and are not confidential. Team members and ADMIN users can write; classmates with class visibility and OBSERVER users may read but cannot write.' },
          { type: 'bullets', items: [
            'Use the note for working decisions, handoffs, and non-sensitive test windows.',
            'A stale save is rejected instead of overwriting a newer revision.',
            'Copy any unsaved text you need, reload the current note, and manually merge the intended change.',
          ] },
        ],
      },
      {
        heading: 'PRIVATE feedback',
        blocks: [
          { type: 'paragraph', text: 'The Feedback tab is a separate private channel for current team members and ADMIN instructional staff. Other teams, classmates outside the team, and observers cannot read it.' },
          { type: 'bullets', items: [
            'ADMIN staff can author categorized posts, pin items, and reference tickets from that team.',
            'Current team members can read, reply, and acknowledge but cannot impersonate staff or edit the original post.',
            'A student TEAM_LEAD remains a student role and is not granted instructor-posting authority.',
          ] },
        ],
      },
      {
        heading: 'Read and write scopes',
        blocks: [
          { type: 'paragraph', text: 'Visibility and mutation checks are enforced by the server. A hidden tab is not the security boundary, and a direct request does not bypass membership rules.' },
          { type: 'bullets', items: [
            'Archived private feedback remains readable to authorized viewers but cannot be changed.',
            'Saved nightly guidance follows the same private team-member and ADMIN read boundary.',
            'Use comments or shared notes for ordinary collaboration and private feedback only for its intended audience.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'instructor-tools',
    title: 'Instructor tools',
    description: 'Manage classes, resources, deliverables, feedback, and nightly review from the ADMIN interface.',
    audience: 'admin',
    sections: [
      {
        heading: 'ADMIN responsibility',
        blocks: [
          { type: 'paragraph', text: 'Instructor functions require the global ADMIN role. A student team lead may coordinate a team, but a student team lead is not staff and cannot use instructor-only authority.' },
          { type: 'bullets', items: [
            'Create, archive, and restore class workspaces from Classes.',
            'Manage users, teams, announcements, global tags, class resources, and deliverables through the application interface.',
            'Archive preserves class evidence and makes its boards read only; it is preferable to destructive cleanup.',
          ] },
        ],
      },
      {
        heading: 'Class setup and distribution',
        blocks: [
          { type: 'paragraph', text: 'A new class can start empty or copy team names from another workspace without copying students or old tickets. Student resources accept only the class’s real web destinations.' },
          { type: 'bullets', items: [
            'Deliverables create unassigned Backlog tickets across teams in the selected active class.',
            'Required and Bonus or Extra classifications use the corresponding global work tags.',
            'Review the confirmation before distribution and verify results in the intended class.',
          ] },
        ],
      },
      {
        heading: 'Nightly review settings',
        blocks: [
          { type: 'paragraph', text: 'Configure nightly review in the Classes interface. It defaults off; enabling it requires an intentional schedule hour and timezone, and Queue now requests work for the separate reviewer.' },
          { type: 'bullets', items: [
            'Use the GUI settings and status shown for the selected class; this guide intentionally provides no operator commands.',
            'Unchanged successful content is skipped, and saved output remains advisory rather than instructor-authored.',
            'Disabling review stops future eligibility without erasing earlier guidance or changing student work.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'ga-checklist',
    title: 'Safe GA checklist',
    description: 'Verify the user experience safely with role coverage and disposable class data only.',
    audience: 'admin',
    sections: [
      {
        heading: 'Safety boundary',
        blocks: [
          { type: 'paragraph', text: 'Perform write-based acceptance checks only in a disposable class created for testing. Confirm the visible class before every mutation and remove only fixtures you created.' },
          { type: 'bullets', items: [
            'Never seed the live system and never reset a live database for acceptance testing.',
            'Never place operational credentials, private infrastructure details, or secrets in tickets or evidence notes.',
            'Treat a test checklist as observed evidence, not as an independent security certification.',
          ] },
        ],
      },
      {
        heading: 'Role matrix',
        blocks: [
          { type: 'paragraph', text: 'Exercise the UI as ADMIN, TEAM_LEAD, MEMBER, and OBSERVER. Verify both the intended positive action and a denied direct attempt for each protected capability.' },
          { type: 'bullets', items: [
            'ADMIN can use instructor tools and manage any team; other roles cannot open ADMIN-only help.',
            'A lead controls a led team, while a member changes only eligible work in a current team.',
            'An observer can browse shared active-board information but has no mutation controls or private feedback access.',
          ] },
        ],
      },
      {
        heading: 'UI acceptance pass',
        blocks: [
          { type: 'paragraph', text: 'Use the normal web interface against the disposable class and record the observed result. Refresh after changes because real-time updates are not part of the current application.' },
          { type: 'bullets', items: [
            'Check ticket creation, assignment, movement, ordering, comments, dates, and archived read-only behavior.',
            'Check planned and actual Gantt dates, unknown older timestamps, one-day bars, and Unscheduled reasons.',
            'Check shared-note conflicts separately from PRIVATE feedback read and write scopes.',
            'Confirm AI and fallback labels, advisory wording, and that guidance does not alter student work or grade it.',
          ] },
        ],
      },
    ],
  },
] as const satisfies readonly HelpGuide[]

const GUIDE_BY_SLUG: ReadonlyMap<string, HelpGuide> = new Map(
  HELP_GUIDES.map((guide) => [guide.slug, guide])
)

export function getHelpGuidesForRole(role: HelpRole): readonly HelpGuide[] {
  return HELP_GUIDES.filter((guide) => guide.audience === 'authenticated' || role === 'ADMIN')
}

export function getHelpGuideForRole(slug: string, role: HelpRole): HelpGuide | undefined {
  const guide = GUIDE_BY_SLUG.get(slug)
  if (!guide || (guide.audience === 'admin' && role !== 'ADMIN')) return undefined
  return guide
}
