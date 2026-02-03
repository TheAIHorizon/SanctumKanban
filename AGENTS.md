# Sanctum Kanban - Agent Guide

This document provides a quick reference for AI agents working on this codebase.

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
│   │   │   ├── tickets/   # Ticket CRUD
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
├── docker-compose.yml     # Production deployment
├── docker-compose.dev.yml # Development (DB only)
└── Dockerfile             # Production image
```

## Database Schema (Prisma)

### Core Models

```
User          - Users with roles (ADMIN, TEAM_LEAD, MEMBER)
Team          - Teams/projects
TeamMember    - Junction: User <-> Team (with role: LEAD/MEMBER)
Ticket        - Kanban tickets (status: BACKLOG/DOING/DONE)
TicketHistory - Audit log for ticket changes
Reflection    - Weekly team reflections (3 columns)
Announcement  - Global announcements (can be pinned)
```

### Key Relationships

- User has many TeamMemberships, Tickets (assigned & created), TicketHistory
- Team has many TeamMembers, Tickets, Reflections
- Ticket belongs to Team, has optional Assignee (User), has History

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

## Running Locally

```bash
# Start database
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies
npm install

# Setup database
npm run db:push
npm run db:seed

# Start dev server
npm run dev
```

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
| `src/components/kanban/TicketCard.tsx` | Ticket rendering (color-coded) |
| `src/components/kanban/KanbanBoard.tsx` | Drag-drop logic |
