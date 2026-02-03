# Sanctum Kanban

A self-hosted, real-time multi-team kanban application with announcements, drag-and-drop tickets, color-coded team members, and reflection boards.

## Features

- **Multi-Team Kanban Boards**: Each team has its own kanban with Backlog, Doing, and Done columns
- **Drag-and-Drop**: Move tickets between columns with intuitive drag-and-drop
- **Color-Coded Members**: Each team member has a unique color - tickets use full background color for a "heat map" effect
- **Compact/Expanded View**: Toggle between compact (title only) and expanded (full details) views; click individual tickets to expand
- **Reflection Boards**: Three-column retrospective boards (What went well, Could improve, Action items)
- **Announcements**: Global announcements banner for all teams
- **User Activity Tracking**: Track ticket history and user activity over time
- **Role-Based Access**: Admin, Team Lead, and Member roles with appropriate permissions
- **Real-Time Updates**: See changes from other users instantly (Socket.IO)
- **Self-Hosted**: Deploy on your own infrastructure with Docker

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui
- **Drag & Drop**: @dnd-kit
- **Real-Time**: Socket.IO

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

### Production Deployment (Docker)

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   
   Set production values:
   ```env
   DATABASE_URL=postgresql://postgres:yourpassword@db:5432/sanctum_kanban
   NEXTAUTH_URL=https://your-domain.com
   NEXTAUTH_SECRET=your-generated-secret
   POSTGRES_PASSWORD=yourpassword
   ```

2. **Build and start**:
   ```bash
   docker-compose up -d --build
   ```

3. **Initialize database**:
   ```bash
   docker-compose exec app npx prisma db push
   docker-compose exec app npm run db:seed
   ```

4. **Access** your app at http://localhost:3456

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
| GET/POST | `/api/users` | List/create users |
| GET/PATCH/DELETE | `/api/users/[id]` | User operations |
| GET | `/api/users/[id]/activity` | User activity history |
| GET/POST | `/api/announcements` | List/create announcements |
| GET/PATCH/DELETE | `/api/announcements/[id]` | Announcement operations |
| GET/POST | `/api/reflections` | Get/update reflections |

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

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:password@host:5432/database`
- For Docker, use `db` as the host (service name)

### Socket.IO not connecting
- Ensure the custom server is running (`npm run start` in production)
- Check that port 3000 is accessible
- For reverse proxy, ensure WebSocket connections are forwarded

### Permission denied errors
- Check user role in database
- Team leads can only manage their own teams
- Members can only edit tickets assigned to them

## License

MIT License - feel free to use this for your own projects!

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
