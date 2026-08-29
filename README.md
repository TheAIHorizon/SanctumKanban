# Sanctum Kanban

A self-hosted multi-team kanban application with announcements, drag-and-drop tickets, color-coded team members, and reflection boards. Real-time collaboration is planned but not yet implemented — see [Real-Time Updates](#real-time-updates) below.

**Part of the [Sanctum Suite](https://github.com/TheAIHorizon)** — Privacy-first, local-AI productivity tools.

## Sanctum Suite

| App | Purpose |
|-----|---------|
| **[Consilium](https://github.com/TheAIHorizon/Consilium)** | Multi-model AI council for comparing, debating, and verifying LLM responses |
| **[Galatea](https://github.com/TheAIHorizon/Galatea)** | Local voice AI companion with vision capabilities |
| **[SanctumWriter](https://github.com/TheAIHorizon/SanctumWriter)** | AI-powered markdown editor for writers |
| **SanctumKanban** | Multi-team project management (this app) |

**Core Principles**: Privacy first • Data sovereignty • Local AI • Self-hosted • No telemetry

## Features

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
- **Role-Based Access**: Admin, Team Lead, and Member roles with appropriate permissions
- **DCWF Alignment** (see below): link tickets to DoD Cyber Workforce Framework tasks, add per-task reflections, and get per-student and per-team work-role alignment reports with AI-assisted task suggestions.
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

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui
- **Drag & Drop**: @dnd-kit
- **Real-Time**: Not implemented (planned; see [Real-Time Updates](#real-time-updates))

## Quick Start

### Prerequisites

- Node.js 18+ or Docker
- PostgreSQL 14+ (or use Docker)

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   cd sanctum-kanban
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your app URL (http://localhost:3456 for development)

3. **Start the database** (if using Docker):
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Initialize the database**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open** http://localhost:3456 and login with:
   - Admin: `admin@example.com` / `admin123`

### Docker Deployment Options

#### Option 1: Full Stack (App + Database)

Deploy both the app and PostgreSQL in containers:

```bash
# Create environment file
cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET (openssl rand -base64 32) and POSTGRES_PASSWORD

# Build and start both containers
docker compose up -d --build
```

That's it. On startup the app container automatically syncs the database
schema (`prisma db push`), so the app is ready at
[http://localhost:3456](http://localhost:3456) with an **empty** database —
no manual init step required.

**Optional — load demo/sample data** (creates an admin + sample teams):

```bash
docker compose exec app npm run db:seed
```

> The seed creates `admin@example.com` / `admin123`. Change these immediately
> for any non-local deployment.

#### Option 2: App Container Only (Existing Database)

If you already have PostgreSQL running (e.g., from development):

```bash
# Build and start only the app container
docker-compose -f docker-compose.app.yml up -d --build
```

This connects to your existing database via `host.docker.internal:5432`.

#### Option 3: Development with Hot Reload

Run the database in Docker, app locally for hot reloading:

```bash
# Start database only
docker-compose -f docker-compose.dev.yml up -d

# Run app locally
npm run dev
```

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Full production stack (app + db) |
| `docker-compose.app.yml` | App container only (uses existing db) |
| `docker-compose.dev.yml` | Database only (for local development) |

**Access** your app at http://localhost:3456

### Production with Reverse Proxy (Recommended)

For HTTPS, use a reverse proxy like Nginx or Caddy. Example Caddy configuration:

```caddyfile
your-domain.com {
    reverse_proxy localhost:3456
}
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, teams, announcements, all tickets |
| **Team Lead** | Manage own team: add/remove members, create/edit/delete tickets, update reflections |
| **Member** | Edit own tickets, move own tickets between columns, view team data |

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
| GET/POST | `/api/teams` | List/create teams |
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
| `AI_BASE_URL` | OpenAI-compatible endpoint for DCWF task suggestions (e.g. `http://localhost:11434/v1` for Ollama, an OpenWebUI URL, or a hosted API). Defaults to local Ollama. | No |
| `AI_MODEL` | Model name for suggestions (e.g. `qwen3.8:27b`) | No |
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
