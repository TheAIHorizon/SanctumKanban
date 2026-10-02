# Sanctum Kanban

**Installing your own copy? Start with [DEPLOY.md](DEPLOY.md) and [AI setup](docs/ai-setup.md).** No access to the maintainer’s NAS or CoyoteGPT is required. Use local models, a shared model server, or an explicitly chosen hosted provider; the core Kanban works without AI.

**New agent or maintainer? Start with [CONTINUATION.md](CONTINUATION.md), then [OPERATIONS.md](OPERATIONS.md).** These cover architecture, feature invariants, local tests, private operational inventory, and safe live-site updates.

> **LIVE SITE OPERATORS:** Read [OPERATIONS.md](OPERATIONS.md) before making changes. This installation is used by students. Preserve its database and verify the exact shared URL; local tests and a GitHub push do not establish live availability. Private target details are in the gitignored `.ops/site.local.json` file. The fresh-install/demo instructions below are not an in-place production update procedure.

A self-hosted multi-team kanban application with announcements, drag-and-drop tickets, color-coded team members, and reflection boards. Real-time collaboration is planned but not yet implemented — see [Real-Time Updates](#real-time-updates) below.

**Part of the [Sanctum Suite](https://github.com/TheAIHorizon)** — Privacy-first, local-AI productivity tools.

## Sanctum Suite

| App | Purpose |
|-----|---------|
| **[Consilium](https://github.com/TheAIHorizon/Consilium)** | Multi-model AI council for comparing, debating, and verifying LLM responses |
| **[Galatea](https://github.com/TheAIHorizon/Galatea)** | Local voice AI companion with vision capabilities |
| **[SanctumWriter](https://github.com/TheAIHorizon/SanctumWriter)** | AI-powered markdown editor for writers |
| **SanctumKanban** | Multi-team project management (this app) |

**Core Principles**: Privacy first • Data sovereignty • Local-first AI • Self-hosted • No application telemetry

External AI is opt-in configuration: feature inputs go to the endpoint you select. A self-hosted Kanban or gateway does not make hosted model processing local. The [AI guide](docs/ai-setup.md) explains what is sent, provider compatibility, and verification.

## Research offshoot planning

The proposed independent SanctumResearch application is described in the [research blueprint](docs/research/BLUEPRINT.md) and [agent handoff](docs/research/AGENT-HANDOFF.md). These are planning documents; this repository continues to run the course Kanban.

## Features

- **Course workspaces:** CSV/Excel and Canvas roster import, team boards or one board per student, searchable/sortable Users with class filters.
- **Evidence and assessment:** DCWF alignment, optional coaching, saved personalized practice/exam versions, class/student assessment library and Canvas QTI exports.
- **Presentation:** team-by-team Detailed/Gantt views, date-range HTML/PDF exports in landscape Letter or Tabloid.

### User and GA documentation

The application header's **Help** link opens `/help`. Signed-in users (including observers) see the user guides; **ADMIN** accounts additionally see instructor tools and the GA checklist. These are curated, server-authorized pages compiled into the app—not raw files from `docs/`. Operational records, private inventory, backups, and credentials are never served by Help. The complete offline handoff documents below remain separate.

- [User manual (offline HTML)](docs/user-manual.html)
- [Assessment history, personalized exams, and Canvas imports](docs/course-assessments.md)
- [Bulk student enrollment from CSV or Excel](docs/student-roster-import.md)
- [AI Coach and grounded DCWF guidance](docs/ai-coach.html)
- [Private instructor feedback and saved nightly AI reviews](docs/feedback-and-nightly-review.html)
- [Live student-site operations and incident/rollback procedures](OPERATIONS.md)
- [Gantt guide and safe future NAS rollout](docs/gantt-guide.html)
- [Automatic completion tracking and planned/actual comparison](docs/completion-tracking.html)
- [GA system check and acceptance checklist (offline HTML)](docs/ga-system-check.html)
- [Code-review findings and remaining work (offline HTML)](docs/code-review.html)
- Run `npm run check:system` for tests, lint, and a production build. Stop the local app first: development and production builds share `.next`.
- The guarded `npm run test:integration` is for the isolated GA test database only, never the live class database. See the checklist for prerequisites.


- **Multi-Class Workspaces**: Run multiple classes/sections at once; each class has its own teams, board, reports, and Cohort Builder target.
- **Class Archive**: Archive a completed class as a preserved, read-only board; restore it later or start a new clean class by copying only the old team layout.
- **Multi-Team Kanban Boards**: Each team has its own kanban with Backlog, Doing, and Done columns
- **Heat Map Overview**: Bird's eye view of all teams - see progress distribution and participation at a glance
- **Drag-and-Drop**: Move tickets between columns with intuitive drag-and-drop
- **Color-Coded Members**: Each team member has a unique color - tickets use full background color for a "heat map" effect
- **Compact/Expanded View**: Toggle between compact (title only) and expanded (full details) views; click individual tickets to expand
- **Search & Filter**: Search tickets, filter by assignee/tag, "My Tickets" toggle, show/hide columns
- **Keyboard Shortcuts**: `N` new ticket, `?` help, `/` search, `M` my tickets, `E` expand/compact
- **Ticket Templates**: Pre-filled formats for Bug, Feature, Task, and Improvement tickets
- **Due Dates**: Set deadlines with visual indicators (overdue = red, due soon = amber)
- **Tags/Labels**: Categorize tickets with colored tags (global or team-specific)
- **Comments**: Threaded discussions on tickets
- **Dark Mode**: Toggle between light, dark, and system themes
- **Reflection Boards**: Three-column retrospective boards (What went well, Could improve, Action items)
- **Announcements**: Global announcements banner for all teams
- **User Activity Tracking**: Track ticket history and user activity over time
- **Role-Based Access**: Admin, Team Lead, Member, and read-only **Observer** roles (see [Permissions](#permissions))
- **Observer mode**: a passwordless, read-only guest view of all team boards — no account needed (see [Permissions](#permissions))
- **DCWF Alignment** (see below): link tickets to DoD Cyber Workforce Framework tasks, add per-task reflections, and get per-student and per-team work-role alignment reports with AI-assisted task suggestions.
- **Cohort Builder** (admin): import a placement survey and let a deterministic solver + optional AI propose balanced student teams, edit them on an interactive board, then provision real accounts (see [Cohort Builder](#cohort-builder)).
- **Real-Time Updates (planned, not implemented)**: The app currently relies on `router.refresh()` after mutations and manual page reload to see other users' changes. An earlier Socket.IO prototype existed but was never wired up (client hook was never called, and the server ran with no authentication), so it has been removed. Live collaboration is on the roadmap.
- **Self-Hosted**: Deploy on your own infrastructure with Docker

## DCWF Alignment

Sanctum Kanban can map student work to the **DoD Cyber Workforce Framework
(DCWF)**. It's designed for instructors monitoring teams of students who build
and defend an enterprise IT environment over a semester.

**How it works**
- Students link their tickets to DCWF **Tasks** (searchable, with a "course
  roles only" filter) and add a short **reflection** per task ("what I did").
- An optional **AI suggest** button proposes the closest DCWF tasks from the
  ticket's text so logging stays low-friction.
- **Reports** (instructor/admin + team leads): pick a student to see their
  activity timeline, logged tasks with reflections, and a ranked **work-role
  alignment** (colored by DCWF Element) — export any report as a self-contained
  **HTML** file.
- **Team coverage**: which course-relevant work roles a team is touching, who's
  contributing to each, and which roles are **gaps** (no work logged yet).

**Setup**
```bash
# 1. Import the DCWF reference data (bundled DCWF v5.2, or bring your own)
npm run db:import-dcwf
#    Docker: docker compose exec app npm run db:import-dcwf

# 2. (Optional) enable AI task suggestions — see Environment Variables below.
#    Without it, suggestions fall back to keyword search (never blocks logging).
```

The DCWF data and the bring-your-own-workbook JSON import format are documented
in [`prisma/dcwf-data/README.md`](prisma/dcwf-data/README.md). A curated ~16
"in-scope" work roles (enterprise build + week-13 pentest/hardening/IR) are the
default report focus; all 76 roles remain available.

## Class Workspaces and Archiving

A **Class Workspace** sits above teams. This lets one deployment host several
course sections or terms at once without mixing their boards:

- Admin → **Classes** creates, archives, restores, and opens classes.
- The dashboard class selector shows one class's teams at a time.
- Students see every team inside classes where they are enrolled, but not other
  classes. Admins can switch across all classes. Observers may browse all active
  classes read-only.
- **Archive** preserves the teams, tickets, reflections, DCWF links, and reports,
  removes the class from the active dashboard, and blocks all board writes.
- **New class** can start empty or copy only another class's team names/layout;
  no old students or tickets are copied.
- Cohort Builder imports and provisions students into a selected active class.
- Existing single-board installations upgrade safely: their current teams and
  memberships are automatically placed into one default class on first use.

## Permissions

Four roles, enforced by a single authorization module (`src/lib/permissions.ts`):

| Capability | Admin | Team Lead | Member | Observer |
|---|:--:|:--:|:--:|:--:|
| View **all** teams' boards & tickets | ✅ | ✅ | ✅ | ✅ |
| Create a ticket in **own** team | ✅ | ✅ | ✅ | — |
| Edit/move a ticket | ✅ | ✅ (own team) | ✅ (own/assigned) | — |
| Archive a ticket | ✅ | ✅ (own team) | ✅ (creator) | — |
| Comments / reflections / DCWF links | ✅ | ✅ | ✅ (own team) | — |
| View **individual** student reports | ✅ | ✅ (own team) | own only | — |
| Admin surfaces (users, teams, cohort builder) | ✅ | — | — | — |

- **Cross-team visibility**: everyone can *see* every team's board, but only members can modify their own team's work.
- **Observer**: click **"Observe without signing in"** on the login page for a passwordless, read-only guest session. Observers see all boards and the heat map but **cannot** write anything or view individual student reports.
- **Archive, not delete**: deleting a ticket archives it (recoverable, hidden from boards). Admins can permanently delete or view archived tickets.

## Cohort Builder

**Admin-only** tool (top nav → *Cohort Builder*) that forms balanced student teams from a placement survey.

1. **Import** a placement-survey CSV (Google Forms export). The importer maps columns by header keyword, so your form stays editable; the legacy survey format is also supported. A ready-to-use question set (DCWF-aligned) is included.
2. **Choose a principle** — Balanced/Parity (default), Coverage, Mentorship, Affinity, Specialization, or Schedule-first — or tune the weight **sliders** directly. A deterministic solver (reproducible; honors mutual partner requests and ≥2 shared meeting days) proposes teams.
3. **Rationale + watch-list** — the configured AI writes each team's "why these three"; a rule-based watch-list flags risks (scarce skills, no OS anchor, schedule conflicts). AI is optional and degrades gracefully to templates.
4. **Review interactively** — drag students between teams; coverage, anchor, and shared-day metrics re-check live. Set each team's lead.
5. **Provision** — one click creates real Teams, student accounts (temporary password; ask students to change it in Profile), and memberships.

AI uses the same provider-agnostic config as DCWF suggestions (`AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`) — point it at a local Ollama, an OpenWebUI/LM-Studio server, or any OpenAI-compatible endpoint.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui
- **Drag & Drop**: @dnd-kit
- **Real-Time**: Not implemented (planned; see [Real-Time Updates](#real-time-updates))

## Quick Start

For a new Docker installation, follow [DEPLOY.md](DEPLOY.md): clone the repo, copy `.env.example`, choose your own secrets, start the app, and run the interactive `db:create-admin` command. Demo seeds are optional and belong only in disposable databases. The guide also covers HTTPS, guest board visibility, DCWF import, workers and verification.

**Choose your AI:** [docs/ai-setup.md](docs/ai-setup.md) includes Ollama, LM Studio/Bionic, Bionic-GPT, OmniRoute, OpenRouter, OpenAI API keys and Anthropic options. No GPU is required in the Kanban host when another server/provider performs inference. Set `AI_MODEL`, `AI_COACH_MODEL` and `AI_ASSESSMENT_MODEL` explicitly; assessments require the separate worker.

### Source development

Use Node.js 20 (matching the Docker image), npm and PostgreSQL. For an isolated local checkout:

```bash
git clone https://github.com/TheAIHorizon/SanctumKanban.git
cd SanctumKanban
npm ci
cp .env.example .env
```

Set `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3456`, and `DATABASE_URL` in `.env`. The development Compose file uses `postgres` / `postgres` on localhost:5432 with database `sanctum_kanban`; it is for disposable local development only. Use a different port/database if you already have PostgreSQL running.

```bash
docker compose -f docker-compose.dev.yml up -d
npm run db:push
npm run db:create-admin
npm run db:import-dcwf
npm run dev
```

Open http://localhost:3456 and sign in with the credentials you just created. For sample content use a separate demo database and the [demo instructions](DEPLOY.md#optional-disposable-presentationdemo-data). Do not seed a live class.

| Compose file | Purpose |
|---|---|
| `docker-compose.yml` | App + database; optional nightly-review profile |
| `docker-compose.assessments.yml` | Assessment worker, combined with the base file |
| `docker-compose.dev.yml` | Disposable development database only |
| `docker-compose.app.yml` | Legacy app-only example with an existing host database; customize its database, URL and AI environment before use |

Existing deployments use [OPERATIONS.md](OPERATIONS.md), not the fresh-install commands. Test → commit → push → verify remote commit → deploy that exact revision. Keep student data, keys, private configuration and backups out of Git.

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, teams, announcements, cohort builder, all tickets |
| **Team Lead** | Manage own team: add/remove members, create/edit/archive tickets, update reflections; view own team's reports |
| **Member** | Create tickets in own team, edit own/assigned tickets, view all teams (read-only elsewhere), view own report |
| **Observer** | Passwordless read-only guest: view all boards + heat map; no writes, no individual reports |

See [Permissions](#permissions) for the full capability matrix.

## Project Structure

```
sanctum-kanban/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── (dashboard)/   # Protected dashboard routes
│   │   ├── api/           # API routes
│   │   └── login/         # Auth pages
│   ├── components/        # React components
│   │   ├── kanban/        # Kanban board components
│   │   ├── reflection/    # Reflection board
│   │   └── ui/            # shadcn/ui components
│   ├── hooks/             # Custom React hooks
│   └── lib/               # Utilities and configurations
├── docker-compose.yml     # Production Docker setup
├── docker-compose.dev.yml # Development (DB only)
└── Dockerfile             # Production image
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/classes` | List/create class workspaces |
| GET/PATCH | `/api/classes/[id]` | Class detail; update/archive/restore |
| GET/POST | `/api/teams` | List/create teams (scoped by `classId`) |
| GET/PATCH/DELETE | `/api/teams/[id]` | Team operations |
| POST/DELETE | `/api/teams/[id]/members` | Team membership |
| GET/POST | `/api/tickets` | List/create tickets |
| GET/PATCH/DELETE | `/api/tickets/[id]` | Ticket operations |
| GET/POST | `/api/tickets/[id]/comments` | Ticket comments |
| PATCH/DELETE | `/api/comments/[id]` | Comment operations |
| GET/POST | `/api/tags` | List/create tags |
| PATCH/DELETE | `/api/tags/[id]` | Tag operations |
| GET/POST | `/api/users` | List/create users |
| GET/PATCH/DELETE | `/api/users/[id]` | User operations |
| GET | `/api/users/[id]/activity` | User activity history |
| GET | `/api/users/[id]/report` | Per-student report (timeline + tasks + alignment) |
| GET | `/api/users/[id]/report/export` | Download student report as HTML |
| GET/POST | `/api/announcements` | List/create announcements |
| GET/PATCH/DELETE | `/api/announcements/[id]` | Announcement operations |
| GET/POST | `/api/reflections` | Get/update reflections |
| GET | `/api/dcwf/tasks` | Search DCWF tasks (type=Task) |
| GET | `/api/dcwf/work-roles` | List DCWF work roles |
| POST | `/api/dcwf/suggest` | AI-suggest DCWF tasks from text |
| GET/POST | `/api/tickets/[id]/dcwf-tasks` | List/link DCWF tasks on a ticket |
| PATCH/DELETE | `/api/ticket-dcwf-tasks/[id]` | Edit reflection note / unlink |
| GET | `/api/teams/[id]/coverage` | Team DCWF role coverage + gaps |
| GET/POST | `/api/cohorts` | List / create cohort (+ CSV import) — admin |
| GET/DELETE | `/api/cohorts/[id]` | Cohort detail (responses + latest run) — admin |
| POST | `/api/cohorts/[id]/solve` | Run the team-formation solver + AI rationale — admin |
| PATCH | `/api/cohorts/[id]/runs/[runId]` | Save review-board edits — admin |
| POST | `/api/cohorts/[id]/provision` | Create real teams + student accounts — admin |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NEXTAUTH_SECRET` | Session encryption key | Yes |
| `POSTGRES_USER` | DB username (Docker) | Docker only |
| `POSTGRES_PASSWORD` | DB password (Docker) | Docker only |
| `POSTGRES_DB` | Database name (Docker) | Docker only |
| `AI_BASE_URL` | Shared OpenAI-compatible Chat Completions base URL (e.g. `http://localhost:11434/v1` for Ollama, an OpenWebUI URL, or a hosted API). Defaults to local Ollama. | No |
| `AI_MODEL` | General AI/cohort rationale model identifier | For AI |
| `AI_COACH_MODEL` | Manual coaching + nightly-review model identifier | For coaching |
| `AI_ASSESSMENT_MODEL` | Assessment worker model identifier (independent of `AI_MODEL`) | For assessments |
| `AI_TIMEOUT_MS` | Default AI timeout; feature-specific deadlines take precedence | No |
| `AI_API_KEY` | Bearer token, only if your AI endpoint requires one | No |

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:password@host:5432/database`
- For Docker, use `db` as the host (service name)

### Permission denied errors
- Check user role in database
- Team leads can only manage their own teams
- Members can only edit tickets assigned to them

## License

**Polyform Noncommercial License 1.0.0** — see [LICENSE](LICENSE) for the full text. Free for
personal, educational, research, and other noncommercial use; commercial use requires a separate
license from the copyright holder. This is the standard license across the Sanctum suite. It is a
**source-available** license, not an OSI "open source" license: the code can be read and audited,
but reuse is limited to noncommercial purposes. (An earlier README claimed "MIT"; that was never
backed by a license file.)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
