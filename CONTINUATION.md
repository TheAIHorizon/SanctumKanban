# SanctumKanban — continuation guide for the next agent

## Start here, every time

1. Read this file and [OPERATIONS.md](OPERATIONS.md).
2. Read the **private, gitignored** `.ops/site.local.json` for the actual shared URL, NAS/SSH port, paths, containers, worker override, and last observed deployment. If missing, obtain it securely from the owner. Do not guess or use a development URL instead.
3. Run `git status --short`, identify the current branch/HEAD/remote, and inspect relevant files before editing. Preserve unrelated work.
4. Establish the requested scope: local development, GitHub publication, or explicitly approved live deployment. They are different outcomes. This NAS serves active students.
5. Treat `.ops/` process handles, record counts, model observations, and release IDs as historical evidence. Re-inspect before relying on them. Never store or print passwords, keys, tokens, environment-file contents, or database dumps in the repository/chat.

## System map

- Next.js 14 App Router, React, TypeScript, Tailwind/shadcn UI.
- PostgreSQL with Prisma; `prisma/schema.prisma` is the model definition.
- NextAuth credentials and a dedicated passwordless observer identity; JWT reads recheck current user state.
- Class workspace → teams → tickets, reflections, shared notes, private instructor feedback, and saved AI guidance.
- The NAS has a separate app container and persistent PostgreSQL volume. The nightly reviewer is a separate non-web worker using the approved app image. Exact private deployment names are in the inventory.
- The public HTTPS hostname/port, reverse proxy, certificate assignment, internal app port, database, model service, and clients' network routes are separate layers. Diagnose the failing layer; a TCP timeout is not a certificate error.

## Where to find each feature

| Area | Entry points |
|---|---|
| Dashboard/class-scoped data | `src/app/(dashboard)/page.tsx`, `src/lib/class-workspaces*.ts` |
| Views and navigation | `src/components/dashboard/TeamGrid.tsx`, `src/components/layout/Header.tsx` |
| Kanban and ticket dialogs | `src/components/kanban/` |
| Gantt/date math | `src/components/dashboard/GanttView.tsx`, `src/lib/gantt*.ts`, `src/hooks/useLocalToday.ts` |
| Planned/actual date transitions | `src/lib/ticket-schedule.ts`, `ticket-start.ts`, `ticket-completion.ts`, ticket POST/PATCH APIs |
| Main authorization | `src/lib/permissions.ts`, `auth.ts`, `ticket-permissions.ts`, `src/middleware.ts` |
| Shared team notes | `src/components/notes/TeamNotes.tsx`, `src/app/api/teams/[id]/note/route.ts` |
| Private instructor feedback | `src/components/feedback/`, `src/lib/instructor-feedback*.ts`, `src/app/api/teams/[id]/feedback/` |
| Manual AI Coach / DCWF | `src/lib/ai.ts`, `dcwf-suggest.ts`, `src/app/api/dcwf/suggest/route.ts`, `TicketAiCoach.tsx`, `DcwfTaskPicker.tsx` |
| Saved guidance | `SavedTicketGuidance.tsx`, `src/app/api/tickets/[id]/guidance/route.ts` |
| Nightly settings/runner | `src/lib/nightly-review*.ts`, `scripts/nightly-ticket-review.ts`, class nightly-review API, `NightlyReviewSettings.tsx` |
| Application Help | `/help`, `/help/[slug]`, `src/lib/help-content.ts` |
| Runtime packaging | `Dockerfile`, Compose files, `docker-entrypoint.sh`, `.dockerignore` |
| Verification | `tests/`, `scripts/system-check.mjs`, `scripts/database-check.mjs`, guarded check scripts below |

## Invariants that must not be lost

### Student work and dates

- No live reset, reseed, database replacement, or volume deletion. Demo seeds regenerate fixed demo boards; they are not safe maintenance commands for student work.
- `startDate` and `dueDate` describe a schedule. `startedAt` and `completedAt` are server-managed event timestamps, not user-editable fields.
- First recorded entry into Doing records `startedAt`. Missing start dates can be auto-filled with provenance; do not present that as an original plan. A real planned start is retained and compared with actual start.
- The first recorded start survives repeated Doing/reopen. Going straight to Done does not invent a start.
- Entering Done records completion; repeated Done/unrelated edits preserve it. Reopening clears the current completion while history preserves the prior event.
- Legacy timestamps remain unknown. Do not backfill them from creation/update dates.
- Keep date-only and UTC-calendar comparisons consistent; distinguish automatic starts after an overdue end from invalid manually planned ranges.
- Reordering must preserve hidden/filtered tickets and synchronize all returned positions. Switching views must not show stale ticket data.

### Roles and private content

- ADMIN is instructional staff in the current role model. A student TEAM_LEAD is **not** automatically an instructor.
- Shared Team Notes are class-visible and can be seen by observers according to existing policy. They are not private feedback.
- Instructor Feedback and saved AI guidance are restricted to current team members and ADMIN staff. Check authorization server-side, not just by hiding tabs.
- Instructor originals/replies are immutable in the first version; students may reply/acknowledge but cannot impersonate staff or change original messages/pins.
- Archived classes preserve reads and reject content mutations. Keep true viewer identity distinct from any UI role spoof used to disable old edit controls.
- Known legacy ticket-list/detail and report-scope issues remain documented in `docs/code-review.html`; do not claim a comprehensive security audit or silently widen them.

### AI and nightly jobs

- CoyoteGPT is user-owned infrastructure; the coaching model defaults to **`laguna-s`** via `AI_COACH_MODEL`. Reuse authorized existing configuration. Never print or commit the API key.
- Manual coaching sends the current draft after an explicit click. Enabled nightly review sends saved title/description text automatically. Neither path should load separate student profiles, comments, or instructor posts into the prompt.
- Suggestions must stay advisory. No automatic ticket rewriting, grading, completion, or DCWF linking.
- Validate model JSON and ground IDs/descriptions in eligible imported DCWF Tasks. Preserve string IDs; never invent workbook row/version provenance.
- Clearly label fallback and abstention. A reachable model is not proof of a validated answer; test an actual response.
- Saved guidance is separate from ticket content. Content/model/prompt-version hashing prevents duplicate successful reviews; retryable fallback updates the same hash record.
- The worker uses a leased, bounded serial batch. No transaction spans inference. Recheck class/ticket/content and lease ownership before saving; fence **completion/error metadata** as well as guidance writes.
- PostgreSQL `timestamp` values used for leases represent UTC. Raw Date binding can shift through the DB session timezone; retain the tested explicit UTC casts/comparisons.
- Dry-run performs no inference, lease acquisition, or writes. Worker errors must be sanitized; a quiet Prisma client prevents database errors from logging guidance text.
- Stop the reviewer as well as app writes before a consistent migration backup/cutover. Stop local reviewers before fixture tests, or they may pick up temporary opt-in test classes.

## Local development and verification

Read the private inventory for the existing local QA database and process records rather than reinstalling a stack. Use explicit local connection overrides; never assume shell exports reached a background process. No production credentials or database should be needed for fixture tests.

Standard checks:

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`npm run check:system -- --database --output /path/to/report.json` runs the combined checks plus a read-only schema probe. **Stop this checkout's local app before building**: dev/prod builds share `.next`. This does not mean stop the NAS.

Guarded local checks require the explicit loopback app/database values documented in the scripts:

- `scripts/ga-integration-check.ts`: real auth/API/database writes on owned synthetic fixtures; cleanup in finally.
- `scripts/gantt-browser-check.mjs`: dates, permissions, responsive Gantt; optional fixture retention is local-only.
- `scripts/ai-coach-check.mjs`: real Laguna S/manual UI and grounding; bounded retry distinguishes fallback from actual AI.
- `scripts/nightly-review-check.ts`: real saved review, CLI, dedupe, timezone lease, and controlled race checks.
- `scripts/feedback-browser-check.mjs`: staff/student/private/archived feedback, saved guidance, and scheduler settings.

Playwright is optional QA tooling, not an app dependency. `PLAYWRIGHT_MODULE` can point to an installed external module; inspect current tooling before installing. Do not run these fixture scripts against the NAS.

Known existing warnings include React-hook dependencies in admin teams, profile activity, and ticket comments, plus build metadata/dynamic-route notices. Distinguish them from new failures. Source has mixed legacy CRLF; use `git -c core.whitespace=cr-at-eol diff --check` rather than reformatting the whole repository during a feature task.

## Help and documentation boundaries

- In-app Help uses a **curated server-rendered allowlist**, not arbitrary file paths or raw handoff HTML. All routes recheck the session; instructor/GA guides are ADMIN-only. Students and observers must not receive those guides through direct URLs or prefetched payloads.
- The full offline manuals/checklists are under `docs/`. Some include operational/historical details; do not blindly move them into `public/` or expose `OPERATIONS.md`, this file, `.ops`, backups, deployment reports, or credentials through Help.
- Maintain both the appropriate in-app guide and offline documentation when behavior changes. Keep historical verification records clearly labeled.
- `OPERATIONS.md` is the deployment safety runbook. `DEPLOY.md` is for a fresh/disposable install, not a shortcut for updating the existing NAS. `docs/live-operations.html` is its readable companion.
- Keep current site-specific release/configuration observations in `.ops/site.local.json` and local process observations in `.ops/runtime.local.json`; revalidate them. Protected operational records stay out of Git, Docker build contexts, and public handoff bundles.

## Before publishing or deploying

1. Gather context and write/run regression tests before code changes. Run real integration/browser checks for changed flows; perform an independent review for multi-file work.
2. Inspect the exact staged files for secrets/unrelated changes. Verify the remote commit after a push. Do not commit or push without user authorization.
3. A source push is not a NAS update. Obtain explicit live-deployment and write-pause approval.
4. Follow `OPERATIONS.md`: current baseline, protected backup, restored-copy rehearsal, approved schema delta, candidate image, final backup under write pause, preserved volume/configuration, and rollback image.
5. Verify both app and worker revisions, schema, selected content integrity, authentication, feature behavior, and the exact public URL/network path. Record access caveats separately; do not change certificates or routing incidentally.
6. Close privileged sessions and leave a concise factual handoff. Delayed subagent notifications are historical reports—do not repeat completed work because they reappear.
