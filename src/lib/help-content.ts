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
        { type: 'paragraph', text: 'Saved versions lists your practice history for the selected course. Filter by status or search a version ID, and use Previous page and Next page to reach older tests. Click a version to reopen it; generating a new test does not replace the earlier versions.' },
        { type: 'paragraph', text: 'Answer all 25 questions and submit once to see your score and explanations. Scores are study feedback, not course grades. AI can make mistakes; ask your instructor about disputed answers. Other students cannot read your tests. Archived courses retain saved tests but reject generation and submissions.' },
      ] },
    ],
  },
  {
    slug: 'instructor-exams',
    title: 'Assessment history and Canvas exams',
    description: 'Browse assessment history by student or class, accept exams, and export quizzes for Canvas.',
    audience: 'admin',
    sections: [
      { heading: 'Prepare an exam', blocks: [
        { type: 'paragraph', text: 'In Assessments, choose a course, enrolled student, date range and Instructor exam draft. Optionally paste reference excerpts or expected procedures. Links are not fetched. The configured AI endpoint receives the selected evidence and supplied references to produce a new saved version. No ticket content is changed.' },
      ] },
      { heading: 'Edit or accept the default', blocks: [
        { type: 'paragraph', text: 'Inspect the evidence snapshot and question sources, edit any question, options, correct answer or explanation, and save your edits. You may also accept the generated default directly. Accept exam freezes that version and records whether it was edited or accepted unchanged. AI correctness is not guaranteed by acceptance.' },
      ] },
      { heading: 'Find every saved assessment', blocks: [
        { type: 'paragraph', text: 'Assessments are saved in the Kanban database. Open Assessments and use the Assessment library. Choose All courses or a specific course, then filter by student, type or status, or search by student name or version ID. Previous page and Next page show the complete history, including failed generations. Staff can still read historical versions after a student leaves a class. Students see only their own practice tests in courses they can access.' },
      ] },
      { heading: 'Download for Canvas', blocks: [
        { type: 'paragraph', text: 'Open an accepted exam or ready practice test and choose Export Canvas quiz for a single QTI ZIP, using four points per question (100 total). For class downloads, choose a specific course in the library. Select versions across pages, or choose Export latest accepted exams for class to include one accepted exam per student. That class button uses the whole selected course, not the library filters. Downloads are limited to 100 quizzes each. Exam drafts must be accepted before export; queued and failed versions cannot be exported.' },
        { type: 'paragraph', text: 'Classic Quizzes: choose the combined QTI package, then in Canvas use Course Settings > Import Course Content > QTI .zip file. New Quizzes: choose individual quiz ZIPs in a bundle, extract that outer bundle, create a new quiz shell for each assessment, and use Build > Options > Import Content to import its individual ZIP. The single-quiz download works in either engine. Each bundle includes instructions and a quiz index.' },
      ] },
      { heading: 'Assign and grade in Canvas', blocks: [
        { type: 'paragraph', text: 'Before publishing, check the imported questions, correct answers, point values and feedback visibility. Assign each personalized quiz only to its intended student and remove Everyone. QTI does not map Kanban users to Canvas enrollments or apply assignment overrides. Each assessment imports as a separate quiz; it does not produce one shared final-exam Gradebook column. Match the New Quizzes assignment points to the quiz total.' },
        { type: 'paragraph', text: 'Students take the quiz in Canvas for Canvas grading. These downloads transfer quiz content, not existing Kanban practice scores or submissions. No Canvas credentials or automatic uploads are involved. Packages contain student names in titles and correct answers; keep them private. Ticket evidence, instructor references, responses and existing scores are excluded.' },
      ] },
      { heading: 'Print an accepted exam', blocks: [
        { type: 'paragraph', text: 'Print student exam contains only questions and choices. Print separate answer key includes correct choices and explanations. Keep the key separate when distributing the exam. Student accounts, including team leads, cannot access instructor drafts, keys or Canvas export packages.' },
      ] },
      { heading: 'Resolve download or import issues', blocks: [
        { type: 'paragraph', text: 'If class export finds no accepted exams, open a ready exam and choose Accept exam. If Export selected is disabled, choose a specific course and select at least one eligible version. Split selections larger than 100 quizzes into smaller downloads. Changing library filters clears the selection.' },
        { type: 'paragraph', text: 'Test an import in your Canvas course before assigning a class batch. If New Quizzes rejects a class bundle, extract it first and select one individual ZIP from its quizzes folder. Keep overwrite matching IDs off during Classic imports unless you intentionally want to replace an earlier import. Institutional Canvas settings can affect the available import options.' },
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
            'For an individual-work class, your instructor can give you a board named after you. Find it under My Teams. Use its tickets, reflections, Gantt chart and exports as usual. New tickets default to you; classmates retain normal viewing access.',
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
    description: 'Use the configured AI for coaching and saved nightly reviews as advisory, grounded assistance.',
    audience: 'authenticated',
    sections: [
      {
        heading: 'Where your information goes',
        blocks: [{ type: 'paragraph', text: 'Your administrator chooses the model service for this installation. It may run locally, on an institutional server, or through a hosted provider. Coaching sends the current ticket draft and retrieved task excerpts; assessments send selected work and any instructor references. A hosted provider processes those inputs outside this server. Ask your administrator which service is configured before entering sensitive material. The repository AI setup guide covers local models, gateways and provider keys.' }],
      },
      {
        heading: 'Manual AI Coach',
        blocks: [
          { type: 'paragraph', text: 'In an editable saved ticket, opening the AI Coach tab sends nothing. Select Ask AI Coach to request guidance from the configured AI service for the current title, description, and retrieved DCWF Task excerpts.' },
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
          { type: 'paragraph', text: 'The configured AI is an adviser, not a verifier and not a grade. Its suggestions can be incomplete, and official task wording comes only from eligible imported records.' },
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
    description: 'Import CSV or Canvas rosters, create individual student boards, find users by class, and manage instructor tools.',
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
        heading: 'Find and sort users',
        blocks: [
          { type: 'paragraph', text: 'On Users, choose a class to see its enrolled accounts, including students who do not yet have a team or individual board. The selector includes active and archived classes, All classes / all users, and No class enrollment. Class filtering does not change enrollment or permissions.' },
          { type: 'paragraph', text: 'Type a first name, last name, partial name or email in Search name or email. Search ignores capitalization and common accents; multiple words may be entered in either name order. It combines with the class filter. Clear filters returns to the full list. The count shows how many users match.' },
          { type: 'paragraph', text: 'Click Name, Email, Contact, Role, Classes, Teams or Joined to sort; click the same heading again to reverse the order. Name sorts by last name, then first name; Joined sorts by account creation date. Empty cells stay last. Classes lists every enrollment; when a class is selected, Teams shows only boards in that class. A user enrolled in several classes appears once in the list. Editing an account keeps the current filter and sort while refreshing the results.' },
        ],
      },
      {
        heading: 'Class setup and distribution',
        blocks: [
          { type: 'paragraph', text: 'A new class can start empty or copy team names from another workspace without copying students or old tickets. Student resources accept only the class’s real web destinations.' },
          { type: 'bullets', items: [
            'Deliverables create Backlog tickets across boards in the selected active class. Group-board tickets start unassigned; individual-board tickets are assigned to their student.',
            'Required and Bonus or Extra classifications use the corresponding global work tags.',
            'Review the confirmation before distribution and verify results in the intended class.',
          ] },
        ],
      },
      {
        heading: 'Bulk import students',
        blocks: [
          { type: 'paragraph', text: 'Create a class in Classes; the student import panel opens after creation. You can also choose Import students on any active class. Download the CSV template and replace the example rows with your students. Use exactly First name, Last name, and Email. In Excel, choose Save As > CSV UTF-8. Upload up to 100 students per file, then choose Preview roster.' },
          { type: 'paragraph', text: 'For Canvas, download Course Analytics (sometimes called New Analytics) > Reports > Class Roster, then upload its CSV. Gradebook CSV exports are also supported when an Email or SIS Login ID column contains full email addresses. Select Canvas roster / Gradebook CSV, check the suggested column mapping, and choose separate name columns, Last, First, or First Last. The last option splits at the first space; use separate columns if compound names are split incorrectly. No email address is invented from a username or SIS number.' },
          { type: 'paragraph', text: 'Canvas uploads can be up to 1 MB, with at most 100 student rows. Only names and emails leave the browser; grades, section data and SIS IDs are excluded. Recognized leading Gradebook metadata rows are ignored. Remove a Canvas Test Student row without an email, correct missing addresses, and keep one row per student if an export repeats section enrollments. Canvas report fields depend on your school’s permissions. Changing column mapping clears the preview so you can review it again.' },
          { type: 'paragraph', text: 'Review which accounts will be created, enrolled or skipped as already enrolled, then choose Import reviewed students. Duplicate emails and invalid rows must be corrected before importing; no partial roster is saved. Existing student accounts are matched by email without regard to capitalization and keep their names, passwords, roles and work. Staff and observer accounts cannot be imported as students. A changed roster or account match requires a new preview.' },
          { type: 'paragraph', text: 'Download new student logins immediately after a successful import. Only newly created accounts receive individual initial passwords; existing students keep their usual login. Share each student’s own credentials privately, never the entire sheet. Ask students to change their password in Profile; a first-login change is not enforced. The page cannot retrieve the generated passwords after you leave. If the response or sheet is lost, check the roster again and reset affected new accounts in Users; reimporting never resets passwords.' },
          { type: 'paragraph', text: 'For individual work, check One Kanban per student before previewing a standard or Canvas roster. Each student gets their own board; already enrolled students can receive a missing board too. Reimports keep existing individual boards and all group work. Without this option, import only enrolls students; use Teams afterward for group boards. Select the option again on later imports. Archived classes reject changes until restored.' },
        ],
      },
      {
        heading: 'One Kanban per student',
        blocks: [
          { type: 'paragraph', text: 'For an existing class, choose One Kanban per student on its Classes card, then Preview individual boards and Create reviewed boards. Enroll students first. The preview lists students and which boards will be created or kept. Instructors and observers are excluded. Repeat after enrolling more students; existing boards are reused even if renamed.' },
          { type: 'paragraph', text: 'Each board is named after its student and has that student as its only member. The student can manage the board without becoming an administrator. It has the usual tickets, reflections, Gantt chart, exports and assessment evidence. New tickets default to the student, and class deliverables are assigned to them. Existing tickets and group boards are unchanged; use a group board if several people need membership.' },
          { type: 'paragraph', text: 'Individual means one student doing the work, not private visibility: classmates can still view boards under current class rules. The same student has a separate board in each class. Copying team names to a new class skips individual boards; create those from the new roster.' },
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
