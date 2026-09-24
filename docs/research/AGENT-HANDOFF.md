# SanctumResearch — handoff for a fresh agent context

Read [BLUEPRINT.md](BLUEPRINT.md) first. This is a research-product plan, not an instruction to convert the live course application in place.

## Starting point and provenance

- Upstream: https://github.com/TheAIHorizon/SanctumKanban
- Pinned application starting point: **d42f55dd76aa820c477c7bdaed42e9b5d8ff33da**.
- This includes application commit **aa57f73fa2e97a9c991406d51ab6dea56380a8ab** (team exports, assessments, support) plus the standing GitHub-before-NAS deployment rule.
- Planning documents may live in a subsequent documentation-only commit. Bring the approved copies of this directory into the new repository and record their source commit separately. Do not silently change the application base to whatever upstream main contains later.
- Preserve history and existing license/notices. Create a separate repository with its own origin, not a permanent research branch of the course repository. Keep the original as an upstream reference for reviewed fixes; do not push research changes back to it.
- The previous release passed 240 unit tests, production build/type checks, and browser checks for course/support flows. Those are baseline evidence, not proof that a four-stage private research app is correct.

## Current scope and working contract

The owner approved preparing the research blueprint and handoff first. Research implementation, repository creation, and deployment are separate milestones; this document does not claim they have happened. When assigned implementation, use the blueprint's defaults and record any owner changes rather than guessing from the old course UI.

Use a dedicated working directory and a research-specific AGENTS.md/CONTINUATION.md. Do not copy the original local folder wholesale: it may contain private .env files, .ops inventory, backups, and database credentials that are deliberately absent from Git. Obtain source from the published pinned commit. Research's private deployment inventory must be newly created for its own stack, not copied from the course site.

The owner requires **test → commit → push to GitHub → verify exact remote commit → deploy that commit to the NAS**. Approval to deploy tested changes includes publication first without another publication confirmation. If publication fails, stop before altering the live deployment. Retain backups and verify real public access. A status question is not deployment authorization.

## Source map and changes to plan

| Existing area | Entry points | Research action |
| --- | --- | --- |
| Schema and relationships | `prisma/schema.prisma` | Replace course entities with research workspace/project/item concepts in a new empty DB. Add project membership roles, collaborators, research fields, publication metadata, and four stages. |
| Workspace selection | `src/app/(dashboard)/page.tsx`, `src/lib/class-workspaces*.ts` | Replace course selection/enrollment queries; apply private project membership checks. |
| Authentication and permission guards | `src/lib/auth.ts`, `permissions.ts`, `ticket-permissions.ts`, `src/middleware.ts` | Remove observer login, distinguish site admin from project role, and enforce project scope on every data route. Audit existing broad read behavior. |
| Cards, drag/drop, filters | `src/components/kanban/`, `src/components/dashboard/TeamGrid.tsx` | Preserve usability and collapsed panels; centralize the four-stage definition for UI/API/validation. |
| Start/completion events | `src/lib/ticket-start.ts`, `ticket-completion.ts`, `ticket-schedule.ts` | Update active-stage transitions; preserve actual versus planned dates and reopening history. |
| Timeline and exports | `src/components/dashboard/GanttView.tsx`, `TeamExport.tsx`, `src/lib/gantt*.ts`, `team-export.ts`, team export API | Four-stage labels and filters; one-project export scope; explicit project-private authorization. |
| Shared notes and comments | `src/components/notes/`, team note API, ticket comment API | Project-only read/write checks; remove course-visible assumptions. |
| Support and help | `src/app/(dashboard)/support/`, `src/app/api/support/`, `src/lib/help-content.ts` | Preserve private support posts; replace course help with research instructions and roles. |
| Packaging | `Dockerfile`, Compose files, `docker-entrypoint.sh` | Research-specific identifiers; independent database/network; remove course worker commands and automatic startup schema synchronization. |

The current `TicketStatus` enum and numerous TypeScript types assume BACKLOG/DOING/DONE. Change the full path: schema, mutation validation, reorder logic, filters, overview totals, cards, dates, export, activity/history rendering, and tests. A column-label-only change is insufficient. Preserve hidden/filtered ticket positions during reordering.

Search for course surfaces across pages, APIs, models, scripts, navigation, generated help, and containers. Remove assessments, cohort building, DCWF, student reports, course reflections, instructor feedback, and course AI workers from the research runtime. Hiding navigation is not removal or authorization. Remove obsolete course-only tests when their features are deliberately removed; replace relevant invariants with research tests rather than retaining misleading green checks.

Do not bulk-upgrade dependencies, add a general workflow designer, extract a shared framework, or enable research AI during the initial separation. Keep the first release focused and attributable.

## Recommended execution sequence

1. Use SanctumResearch unless the owner specifies another name. Resolve repository visibility and the assigned implementation milestone from recorded owner decisions; ask only for missing inputs. Verify the pinned upstream commit exists. Create the separate repository and record its upstream provenance; make the research origin unmistakable before pushing.
2. Establish separate local app/database configuration and synthetic-only seed/bootstrap procedures. Fail closed if a fixture script receives an unrecognized database, host, or app target. Never weaken the existing QA guards to run against a NAS database.
3. Replace the data model and authorization together. Start with private project access before adapting dashboards or exports. Remove the observer authentication provider and direct observer API access.
4. Implement the four-stage workflow, research fields, project roles, ownership/collaboration, and completion behavior. Consolidate status definitions rather than adding another set of scattered string unions.
5. Adapt boards, overview, Gantt, notes/comments, support, and exports. Rewrite help and remove course surfaces. Use synthetic examples covering a technical report and an inconclusive investigation.
6. Run focused unit/API/browser checks, review authorization separately from UI behavior, then build the production AMD64 candidate. Verify migrations from an empty DB and from the previous research version once one exists.
7. Publish the exact tested commit before deployment. On the research stack only, rehearse backups/migrations, deploy that commit, and verify the actual research hostname and normal TLS. Confirm the course containers, volume, routing, and workers remain unchanged.
8. Deliver a factual handoff: commit, image revision, source provenance, schema version, tests, actual deployment state, backups/rollback, network limitations, and next milestone. Preserve secrets and actual infrastructure details only in private operational storage.

## Required acceptance cases

- Two private projects with disjoint members: list/detail/search/notes/comments/history/exports cannot leak the other project's data; guessed item IDs and direct URLs fail.
- Site admin, lead, contributor, viewer, anonymous access, removed membership, and deleted account behavior are exercised through real server APIs. A lead in Project A has no authority in Project B.
- An owner/collaborator must belong to the project; forged cross-project IDs and contributor attempts to manage membership or accept Done fail.
- Reordering preserves filtered and hidden items. All four stages agree across board, filters, overview, history, Gantt, and exports.
- First actual start survives backward movement; completion is stable while Done; reopening records history and clears current completion; direct completion does not fabricate a start.
- Archived projects preserve authorized reads and reject writes, including direct API calls. Restore is restricted to site administrators.
- Negative/inconclusive research can finish with an explicit outcome. Publication changes do not imply task completion, modify actual completion dates, or block completion awaiting a journal.
- Letter and Tabloid landscape exports render one authorized project and the chosen dates, with readable long titles and multiple pages. Browser checks include mobile layouts.
- Support remains private to submitter/site admin. Removed course routes, observer login, demo default passwords, and course workers are absent from the research release.
- Research Compose uses its own DB container/volume/network/secrets; no course mounts or database connections. Web restart does not run schema modifications or seeds. Rollback preserves newer records.
- No Slack or AI traffic in the first-release tests. Later integrations require their own access, payload, duplicate-delivery, and outage acceptance checks.

## Fresh-context starter prompt

> We are building SanctumResearch as a separate product derived from SanctumKanban. Read docs/research/BLUEPRINT.md and docs/research/AGENT-HANDOFF.md, then the research repository's AGENTS.md and operational guide. Start from the pinned upstream commit and preserve provenance. Implement only the milestone assigned in this conversation. Use a separate synthetic research database and keep the course app, student data, workers, and deployment untouched. The first release has private projects, four research stages, structured evidence/findings, project roles, and existing board/Gantt/export usability. Remove course-only features. Slack and research AI are later milestones. Test, commit, push, verify the exact GitHub commit, then deploy only when the research release is approved. Report actual evidence and maintain a continuation guide so another agent can resume without chat history.
