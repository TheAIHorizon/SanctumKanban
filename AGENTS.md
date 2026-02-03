# Sanctum Kanban - Agent Guide

This document provides a quick reference for AI agents working on this codebase.

## Sanctum Suite Context

SanctumKanban is part of the **Sanctum Suite** — a collection of privacy-first, local-AI productivity tools:

| App | Purpose | Repo |
|-----|---------|------|
| **Consilium** | Multi-model AI council | [GitHub](https://github.com/lafintiger/Consilium) |
| **Galatea** | Local voice AI companion | [GitHub](https://github.com/lafintiger/galatea) |
| **SanctumWriter** | AI-powered markdown editor | [GitHub](https://github.com/lafintiger/SanctumWriter) |
| **SanctumKanban** | Multi-team project management | This repo |

### Core Principles (MUST follow)

1. **Privacy First** - All processing happens locally
2. **Data Sovereignty** - Nothing leaves the user's machines
3. **Local AI** - Use Ollama/LM Studio, NOT cloud APIs (OpenAI, Anthropic, etc.)
4. **Self-Hosted** - If a server is involved, user owns it
5. **No Telemetry** - No external data sharing

### Future AI Integration

When adding AI features, connect to **Ollama** (localhost:11434) like the other Sanctum apps do. Do NOT add OpenAI/Anthropic/cloud API integrations.

## Project Overview

**Sanctum Kanban** is a self-hosted, real-time multi-team kanban application built with Next.js 14. It features drag-and-drop tickets, color-coded team members (full card background creates a heat map effect), reflection boards, and announcements.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js (credentials provider) |
| UI | Tailwind CSS + shadcn/ui components |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable |
| Real-time | Socket.IO |
| Containerization | Docker + Docker Compose |

## Directory Structure

```
sanctum-kanban/
├── prisma/
│   ├── schema.prisma      # Database schema - ALL models defined here
│   └── seed.ts            # Database seeding script
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (dashboard)/   # Protected routes (requires auth)
│   │   │   ├── page.tsx   # Main dashboard - shows all team kanbans
│   │   │   ├── admin/     # Admin-only pages
│   │   │   │   ├── announcements/
│   │   │   │   ├── teams/
│   │   │   │   └── users/
│   │   │   └── profile/   # User profile settings
│   │   ├── api/           # API routes
│   │   │   ├── auth/      # NextAuth endpoints
│   │   │   ├── teams/     # Team CRUD + members
│   │   │   ├── tickets/   # Ticket CRUD + comments
│   │   │   ├── tags/      # Tag CRUD
│   │   │   ├── comments/  # Comment operations
│   │   │   ├── users/     # User CRUD + activity
│   │   │   ├── announcements/
│   │   │   └── reflections/
│   │   ├── login/         # Public login page
│   │   ├── globals.css    # Global styles + Tailwind
│   │   ├── layout.tsx     # Root layout
│   │   └── providers.tsx  # SessionProvider wrapper
│   ├── components/
│   │   ├── kanban/        # Kanban board components
│   │   │   ├── TeamKanban.tsx      # Team container with tabs
│   │   │   ├── KanbanBoard.tsx     # DnD context + columns
│   │   │   ├── KanbanColumn.tsx    # Droppable column
│   │   │   ├── TicketCard.tsx      # Draggable ticket (COLOR-CODED)
│   │   │   ├── CreateTicketDialog.tsx
│   │   │   └── EditTicketDialog.tsx
│   │   ├── reflection/    # Reflection board (3 columns)
│   │   ├── announcements/ # Announcements banner
│   │   ├── dashboard/     # Dashboard components
│   │   ├── layout/        # Header, navigation
│   │   └── ui/            # shadcn/ui components
│   ├── hooks/
│   │   ├── use-toast.ts   # Toast notifications
│   │   └── useSocket.ts   # Socket.IO client hook
│   ├── lib/
│   │   ├── auth.ts        # NextAuth configuration
│   │   ├── prisma.ts      # Prisma client singleton
│   │   ├── socket.ts      # Socket.IO server utilities
│   │   └── utils.ts       # Utility functions (cn, colors, dates)
│   ├── middleware.ts      # Auth middleware + route protection
│   └── types/
│       └── next-auth.d.ts # NextAuth type extensions
├── server.ts              # Custom server with Socket.IO
├── docker-compose.yml     # Full stack (app + db)
├── docker-compose.app.yml # App container only (uses existing db)
├── docker-compose.dev.yml # Development (DB only)
└── Dockerfile             # Production image (Node.js Alpine + OpenSSL)
```

## Database Schema (Prisma)

### Core Models

```
User          - Users with roles (ADMIN, TEAM_LEAD, MEMBER)
Team          - Teams/projects
TeamMember    - Junction: User <-> Team (with role: LEAD/MEMBER)
Ticket        - Kanban tickets (status: BACKLOG/DOING/DONE, dueDate, tags, comments)
TicketHistory - Audit log for ticket changes
Tag           - Labels for tickets (global or team-specific)
TicketTag     - Junction: Ticket <-> Tag (many-to-many)
Comment       - Threaded discussions on tickets
Reflection    - Weekly team reflections (3 columns)
Announcement  - Global announcements (can be pinned)
```

### Key Relationships

- User has many TeamMemberships, Tickets (assigned & created), TicketHistory, Comments
- Team has many TeamMembers, Tickets, Reflections, Tags
- Ticket belongs to Team, has optional Assignee (User), has History, Tags, Comments
- Tag can be global (teamId=null) or team-specific

## Authentication & Authorization

### Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access to everything |
| TEAM_LEAD | Manage own team, create/edit tickets, update reflections |
| MEMBER | Edit/move own assigned tickets only |

### Auth Flow

1. `middleware.ts` protects routes matching `/, /teams/*, /admin/*, /profile/*`
2. Admin routes additionally check `token.role === 'ADMIN'`
3. API routes use `getServerSession(authOptions)` for auth checks

## Key Patterns

### Server Components vs Client Components

- **Server Components** (default): Dashboard page, data fetching
- **Client Components** (`'use client'`): Interactive UI, forms, drag-drop

### Data Fetching

- **Server**: Direct Prisma queries in page components
- **Client**: Fetch API to `/api/*` routes

### State Updates

After mutations (create/update/delete), call `router.refresh()` to revalidate server data.

### Ticket Colors (Heat Map)

Tickets use the assignee's `color` field as the full background color. This creates a visual heat map showing who is doing the work. See `TicketCard.tsx`:

```typescript
const cardColor = ticket.assignee?.color || '#e5e7eb' // Gray for unassigned
const textColor = getContrastColor(cardColor) // Auto black/white for readability
```

### Compact/Expanded View

Kanban boards support compact mode to handle teams with many tickets:

- **Default**: Compact view - shows title + assignee initials only
- **Toggle**: Click the expand/minimize icon in the team header to switch all tickets
- **Individual expand**: Click any ticket to expand just that one for details
- **Props flow**: `TeamKanban` → `KanbanBoard` → `KanbanColumn` → `TicketCard` all pass `compactView` prop

See `TicketCard.tsx` for implementation:
```typescript
const showExpanded = !compactView || isExpanded // Local expand state
```

### Due Dates

Tickets can have optional due dates with visual indicators:
- **Overdue**: Red calendar icon (past due)
- **Due Soon**: Amber calendar icon (within 2 days)
- **OK**: Normal display

```typescript
const getDueDateStatus = () => {
  if (!ticket.dueDate) return null
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 2) return 'soon'
  return 'ok'
}
```

### Tags/Labels

Tags categorize tickets and can be:
- **Global**: Available to all teams (teamId = null)
- **Team-specific**: Only available to one team

Admin page at `/admin/tags` for management. Tags display as colored badges on expanded tickets.

### Comments

Tickets support threaded comments via the Edit Ticket dialog → Comments tab:
- `GET/POST /api/tickets/[id]/comments` - List/add comments
- `PATCH/DELETE /api/comments/[id]` - Edit/delete own comments
- Comment count shown on ticket cards

### Dark Mode

Uses `next-themes` for theme management:
- Toggle in header (sun/moon icon)
- Options: Light, Dark, System
- Persists in localStorage

```typescript
// src/components/theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes'
```

### Heat Map Overview

Bird's eye view showing all teams as compact mini-kanbans:
- Toggle between "Detailed" and "Overview" modes in `TeamGrid.tsx`
- Each team shows tickets as small colored squares (assignee color)
- Health indicator: 🟢 Healthy, 🟡 Backlogged, 🔴 Needs attention
- Participation bar shows workload distribution by color
- Click team to drill down, "Back to Overview" to return

See `src/components/dashboard/HeatMapView.tsx`

### Search & Filter

Filter bar in each team's kanban (`FilterBar.tsx`):
- Search by ticket title/description
- Filter by assignee (including "unassigned")
- Filter by tags (multi-select)
- "My Tickets" toggle
- Show/hide columns (Backlog, Doing, Done)

Filters are managed in `TeamKanban.tsx` state and passed to `KanbanBoard.tsx`.

### Keyboard Shortcuts

Global shortcuts handled in `TeamKanban.tsx` useEffect:

| Key | Action |
|-----|--------|
| `N` | Create new ticket |
| `?` | Show shortcuts help |
| `/` | Focus search input |
| `M` | Toggle "My Tickets" filter |
| `E` | Toggle compact/expanded view |
| `Esc` | Close dialogs, clear search |

Help dialog: `src/components/keyboard/KeyboardShortcutsHelp.tsx`

### Ticket Templates

Pre-defined ticket formats in `CreateTicketDialog.tsx`:
- **Blank**: Empty form
- **Bug**: Steps to reproduce format
- **Feature**: Problem/solution/acceptance criteria
- **Task**: Objective/steps checklist
- **Improvement**: Current state/desired improvement

Templates pre-fill title prefix and description structure.

## Common Tasks

### Adding a New API Route

1. Create file in `src/app/api/[resource]/route.ts`
2. Export async functions: `GET`, `POST`, `PATCH`, `DELETE`
3. Use `getServerSession(authOptions)` for auth
4. Use `prisma` client for database operations

### Adding a New Page

1. Create file in `src/app/(dashboard)/[page]/page.tsx`
2. Server component by default, add `'use client'` if needed
3. Protected by middleware automatically

### Adding a New UI Component

1. For shadcn components: Create in `src/components/ui/`
2. For feature components: Create in appropriate feature folder
3. Use `cn()` utility for conditional classNames

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` (dev) or `npm run db:migrate` (prod)
3. Prisma client auto-regenerates

## Environment Variables

```env
DATABASE_URL          # PostgreSQL connection string
NEXTAUTH_URL          # App URL (http://localhost:3456)
NEXTAUTH_SECRET       # Session encryption key
PORT                  # Server port (default: 3456)
```

## Running the App

### Option 1: Local Development (Hot Reload)

```bash
# Start database in Docker
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies & setup
npm install
npm run db:push
npm run db:seed

# Start dev server with hot reload
npm run dev
```

### Option 2: Full Docker (Production)

```bash
# Build and run both app + db containers
docker-compose up -d --build

# Initialize database
docker-compose exec app npx prisma db push
docker-compose exec app npm run db:seed
```

### Option 3: App in Docker, Existing DB

```bash
# If PostgreSQL is already running (e.g., from dev)
docker-compose -f docker-compose.app.yml up -d --build
```

### Docker Files

| File | Use Case |
|------|----------|
| `docker-compose.yml` | Full production (app + PostgreSQL) |
| `docker-compose.app.yml` | App container only, connects to `host.docker.internal:5432` |
| `docker-compose.dev.yml` | PostgreSQL only, run app with `npm run dev` |
| `Dockerfile` | Multi-stage build (Node.js 20 Alpine, includes OpenSSL for Prisma) |

## Default Login

- **Admin**: `admin@example.com` / `admin123`
- **Users**: `john@example.com`, `jane@example.com`, `bob@example.com` / `password123`

## Important Files to Know

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database models - start here for data structure |
| `src/lib/auth.ts` | Auth configuration and callbacks |
| `src/middleware.ts` | Route protection rules |
| `src/app/(dashboard)/page.tsx` | Main dashboard |
| `src/app/(dashboard)/admin/tags/page.tsx` | Tag management (admin) |
| `src/components/dashboard/TeamGrid.tsx` | View mode toggle (Detailed/Overview) |
| `src/components/dashboard/HeatMapView.tsx` | Bird's eye heat map view |
| `src/components/kanban/TeamKanban.tsx` | Team container, filters, keyboard shortcuts |
| `src/components/kanban/FilterBar.tsx` | Search and filter controls |
| `src/components/kanban/TicketCard.tsx` | Ticket rendering (color-coded, tags, due dates) |
| `src/components/kanban/KanbanBoard.tsx` | Drag-drop logic, column visibility |
| `src/components/kanban/CreateTicketDialog.tsx` | Ticket creation with templates |
| `src/components/kanban/EditTicketDialog.tsx` | Ticket editing with comments |
| `src/components/keyboard/KeyboardShortcutsHelp.tsx` | Shortcuts help dialog |
| `src/components/theme-toggle.tsx` | Dark mode toggle |
