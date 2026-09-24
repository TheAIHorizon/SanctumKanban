# SanctumResearch — product and separation blueprint

Status: planning baseline, 2026-09-24. The owner approved the direction: derive an independent research application from SanctumKanban, write the blueprint and handoff first, then build in a dedicated workspace. This document describes the proposed first release; it does not claim that the research repository, application, or deployment already exists.

Implementation companion: [AGENT-HANDOFF.md](AGENT-HANDOFF.md).

## Decision and rationale

Create **SanctumResearch**, an independent repository retaining the existing Git history through the selected starting commit. Reuse the tested board infrastructure instead of rewriting it. Give research its own product model, authorization, database, Docker deployment, and releases. Keep SanctumKanban serving courses independently.

A formal GitHub fork is unnecessary for this product split. A permanent branch is not the product boundary. A single application with course/research switches would couple unrelated permissions, schema changes, and release schedules. A shared library can come later if repeated maintenance demonstrates a stable common core; do not build a generic platform first.

The cost of separation is maintaining common fixes in two repositories. Record each release's upstream base; evaluate shared fixes individually and transfer them with provenance. Never automatically merge course features into research, or assume a fix applies safely to both.

## First-release product model

| Concept | Meaning |
| --- | --- |
| Workspace | A research group or program containing projects; start with one workspace but retain the grouping model. |
| Project | A private research board and its explicitly assigned members. A person can belong to multiple projects. |
| Research item | One research question, investigation, or defined deliverable represented by a card. It need not be an entire paper. |
| Accountable owner | One person responsible for the item's progress; collaborators can contribute without obscuring ownership. |
| Deliverable | A report, manuscript, presentation, repository, dataset, prototype, or documented finding. |

Small activities begin as checklist items within a card, not another hierarchy of boards. Display terms and internal models should describe research; do not merely relabel Classes and leave course authorization underneath.

### Board workflow

**Backlog → Researching → Writing & Review → Done**

| Stage | Meaning |
| --- | --- |
| Backlog | Proposed questions or deliverables, awaiting selection and assignment. |
| Researching | Active investigation, source gathering, experiments, or analysis. |
| Writing & Review | Findings are being organized, checked, written, and prepared for delivery. |
| Done | The defined research work is complete and its outcome has been recorded. |

Allow backward movement and reopening, retaining history. Keep blocked work in its current stage with a blocker note; do not add a fifth column initially. Reuse color-coded ownership, independently collapsed boards, filtering, and Gantt/print exports.

**Publication is separate from board completion.** A paper may be submitted but still awaiting an external decision after the research work is complete. Suggested optional publication values: Not applicable, Draft, Submitted, Accepted, Published. Record venue and publication link when relevant. Do not automatically change completion dates when publication status changes. A useful negative or inconclusive finding is a valid outcome.

### Research item fields

| Field | First-release behavior |
| --- | --- |
| Title and research question/objective | Short title plus the question or intended deliverable. |
| Approach | Methods, planned investigation, or work checklist. |
| Owner and collaborators | One optional owner in Backlog; assign an owner before active work. All must be current project members. |
| Sources/evidence | Labeled references or links, with optional notes. Plain text and links initially; no automatic retrieval or file uploads. |
| Findings and limitations | What was learned, supporting reasoning, and remaining uncertainty. |
| Deliverable reference | Link or written location/description of the output. |
| Dates, tags, comments, history | Reuse the existing foundation, adapted to the four stages. |
| Blocker | Optional note explaining what prevents progress. |
| Publication metadata | Optional status, venue, and link; independent of the work stage. |

Suggested completion rule for the pilot: record a short outcome and a deliverable reference, or an explanation of why no separate artifact is appropriate. Make the rule clear in the UI. Project leads accept completion; contributors can move assigned/collaborated work through Researching and Writing & Review. This is a proposed pilot default, not a journal-publication requirement.

Preserve planned versus actual dates. Record the first actual start on entry to Researching or Writing & Review; do not overwrite it on later moves. Entering Done records completion, repeated Done saves retain it, and reopening clears current completion while preserving the history. A direct Backlog-to-Done move must not invent a start. Continue UTC calendar-day semantics and distinguish automatically filled schedule dates from original plans.

## Scope: retain, replace, defer

| Area | Decision |
| --- | --- |
| Accounts, board interactions, comments, history, tags, dates | Retain and adapt; reassess authorization throughout. |
| Collapsed boards, overview, Gantt, one-project HTML/PDF exports | Retain and test with four stages and project-private access. |
| Shared notes | Retain as project notes, visible only to authorized project members. |
| Announcements | Retain; first-release global announcements are for all signed-in accounts and must not disclose private project content. |
| Requests & bugs | Retain: submitter and site administrator only. |
| Classes and teams | Replace with research workspaces and project boards/membership. |
| Exams, student reports, cohort builder, DCWF, weekly course reflections | Remove from the research product, including APIs, workers, seeds, navigation, and help. Do not change them in the course app. |
| Instructor feedback and saved course AI guidance | Do not carry over as research review machinery; use project comments/notes initially. |
| Course assessment and nightly review workers | Do not run or connect them in research. |
| Research AI, citation extraction, automatic literature search | Deferred. Future AI must use user-owned/local infrastructure and remain advisory. |
| Slack | Staged follow-on after the manual research workflow passes a pilot. |
| Attachments, voting, nested projects, dependencies, real-time collaboration | Deferred unless a concrete pilot need justifies them. |

## Identity and access

No passwordless observer provider, anonymous board browsing, or automatic access because someone has the project URL. Source-code visibility on GitHub does not determine research-data visibility.

| Role | Access |
| --- | --- |
| Site administrator | Manage accounts, workspaces, and all projects; may inspect research content. Make this administrative access explicit. |
| Project lead | Manage their project's members, items, and acceptance/reopening of completed work. No access to other projects by default. |
| Contributor | Read their project, create items, comment, and edit their own/assigned/collaborated items; cannot manage membership or accept Done. |
| Viewer | Signed-in, explicitly assigned read-only access to a project. |

Workspace membership alone does not grant access to every project. Require the project membership as well, except for site administrators. Scope list, detail, search, history, comments, notes, exports, and future Slack actions server-side. A lead is a project membership role, not a site-wide administrative privilege. Archived projects preserve authorized reads and reject content/membership changes; site administrators can restore them.

Start with administrator-created accounts and assignment of existing accounts to projects. Do not implement email invitations, public registration, or shared course credentials in the first release. Remove access immediately when membership/account status changes. Provide a one-time, operator-controlled administrator bootstrap without committed default passwords.

## Slack follow-on

The board remains the authoritative record. Link projects to explicitly selected channels; channel membership never substitutes for app authorization.

1. **Notifications:** opt-in events for assignment, review requests, and completed deliverables. Start with minimal text and a board link. Card titles themselves may be sensitive; make the allowed payload explicit.
2. **Capture:** a deliberate action creates a card from a selected Slack message and retains the message link. Do not ingest the channel history automatically.
3. **Actions:** selected assignment/status actions after Slack identities are explicitly mapped to app accounts and project permissions are checked.

Use an asynchronous, bounded delivery queue with event IDs, retries, and duplicate suppression. A Slack outage must not block saving work or produce a notification loop. Honor project/channel opt-outs at delivery time, not just enqueue time. Test with a dedicated synthetic project/channel before real content.

Slack is an explicit opt-in exception to local-only data handling: anything posted there leaves the NAS. Keep evidence, drafts, attachments, and private comments out by default. Do not enable or send messages as part of preparing this blueprint. For later interactive integration, Socket Mode is a candidate because it supports events without a public HTTP callback endpoint; it still requires a Slack app, credentials, and an outbound connection. See [Slack's Socket Mode documentation](https://docs.slack.dev/apis/events-api/using-socket-mode/).

## Repository and deployment boundary

- Independent GitHub repository and local working directory, retaining source history and license/notices. Decide new-repository visibility before creating it; keep research content and operational records out of Git either way.
- Separate Compose project, app image, PostgreSQL container/database/credentials, network, named volume, session secret, backups, and public origin. Do not attach the research app to the course database network or reuse course cookies/configuration.
- Start with an empty research database and synthetic fixtures. No course database clone, student-account import, shared volume, or automatic data synchronization.
- The same NAS may host both, subject to capacity checks. Plan research's hostname/certificate coverage and unused host port before deploying. Do not change the course route or certificate assignment to make room.
- Use versioned, reviewed database migrations applied as a deliberate release step. The research web startup should start the server, not run the inherited automatic `prisma db push`.
- Publish the tested candidate to GitHub and verify its exact commit before any NAS deployment. Build and label the image from that commit. Rehearse migrations/restores, preserve rollback images, and verify the exact public URL with normal TLS. Local builds and source publication are not live acceptance.

## Delivery milestones and acceptance

| Milestone | Deliverable | Acceptance evidence |
| --- | --- | --- |
| 0 — Blueprint | This plan plus an actionable agent handoff | Workflow, access rules, separation, exclusions, and remaining deployment choices are explicit. |
| 1 — Isolated foundation | New repository/workspace and synthetic local research stack | Fresh research database; no course mounts/credentials/workers; course app untouched; provenance recorded. |
| 2 — Research workflow | Four-stage board, structured research fields, collaborators, review, dates | Two synthetic projects and complete example investigations, including an inconclusive result; transitions, history, ownership, and completion rules tested. |
| 3 — Usable first release | Private access, notes/comments, filters, overview, Gantt, exports, support, help | Cross-project denial through APIs and exports; lead/contributor/viewer tests; archive/reopen/date tests; readable one-project Letter/Tabloid exports. |
| 4 — Research pilot | Tested published commit deployed to its independent NAS stack | Backup/restore rehearsal, migration verification, authentication/public URL checks, isolation from course services, and a short user walkthrough. |
| 5 — Slack notifications | Opt-in notification integration | Approved channel/payload, identity/access policy, dedupe/retry/outage tests, and no unauthorized content disclosure. |

Before milestone 1, settle repository visibility. Before milestone 4, identify the research public origin, available NAS capacity/port, and initial administrator access method. Before milestone 5, select the Slack workspace/channel and allowed notification content. These are implementation/deployment inputs, not reasons to change the existing course application.
