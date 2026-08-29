# Deploying Sanctum Kanban (for an automated/keeper agent)

This is a self-contained runbook to deploy Sanctum Kanban with Docker and
**populated demo data** (6 teams, ~160 tickets, DCWF alignment links) so
evaluators can log in and see a fully-populated app immediately.

The app is **Next.js 14 + PostgreSQL (Prisma) + NextAuth**. AI features are
optional and provider-agnostic (see step 5). No GPU is required on the host —
the AI runs on a remote OpenAI-compatible endpoint.

---

## 0. Requirements on the host

- Docker + Docker Compose v2 (`docker compose`, not `docker-compose`)
- Ports: **3456** (app) and **5432** (Postgres) available, or remap in `docker-compose.yml`
- Outbound HTTPS if you enable the remote AI endpoint (optional)

## 1. Clone

```bash
git clone https://github.com/TheAIHorizon/SanctumKanban.git
cd SanctumKanban
```

## 2. Create the environment file

```bash
cp .env.example .env
```

Then edit `.env` and set at minimum:

| Var | Value |
|-----|-------|
| `POSTGRES_USER` | e.g. `postgres` |
| `POSTGRES_PASSWORD` | a strong password |
| `POSTGRES_DB` | `sanctum_kanban` |
| `NEXTAUTH_SECRET` | run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | the URL users will reach it at (e.g. `https://kanban.example.org` or `http://<host-ip>:3456`) |

> **`NEXTAUTH_URL` matters**: logins/sessions break if it doesn't match the
> URL evaluators actually visit. For a plain IP/port deploy, use
> `http://<host-ip>:3456`. Behind a reverse proxy, use the public https URL.

`DATABASE_URL` is **not** needed in `.env` for the Docker path — the app
container sets it automatically to point at the `db` service. (It's only used
for running the app outside Docker.)

## 3. Build and start

```bash
docker compose up -d --build
```

The app container's entrypoint auto-runs `prisma db push` (idempotent schema
sync) on every start, then launches the server. Wait until:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3456/login   # expect 200
```

## 4. Initialize data (run once)

```bash
# DCWF reference data (needed for alignment reports + cohort builder)
docker compose exec app npm run db:import-dcwf

# Populated demo data: 6 teams, ~160 tickets, DCWF links, admin + demo users
docker compose exec app npm run db:seed-demo
```

`db:seed-demo` is idempotent (safe to re-run) and self-sufficient — it creates
the admin if missing and requires the DCWF import above. For a **clean/empty**
deploy instead, skip `db:seed-demo` and create your own admin.

### Logins after `db:seed-demo`

- **Admin**: `admin@example.com` / `admin123`
- **Demo students**: `<first>.<last>@example.com` / `password123`
  (e.g. try the Team Echo members; all use `password123`)
- **Observer**: on the login page, click **"Observe without signing in"** —
  read-only, no account needed.

> Change the admin password immediately for any non-throwaway deployment.

## 5. (Optional) Enable AI features

DCWF task suggestions and Cohort Builder rationale use any OpenAI-compatible
endpoint. Without it they fall back gracefully (keyword search / template text).
Add to `.env` and restart (`docker compose up -d`):

```bash
AI_BASE_URL="https://<your-openai-compatible-host>/v1"   # or /api for Open WebUI
AI_MODEL="<model-name>"
AI_API_KEY="<key-if-required>"
AI_TIMEOUT_MS="90000"    # raise for slow local models
```

> Reasoning models (e.g. Qwen "thinking" variants) need a high `max_tokens`;
> the app already appends `/no_think` for them.

## 6. Verify

```bash
docker compose ps                       # both services Up; db healthy
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3456/login   # 200
```

Open `NEXTAUTH_URL` in a browser, log in as admin, and confirm the dashboard
shows the demo teams and the **Reports** / **Cohort Builder** nav entries.

---

## Architecture notes for the deployer

- **DS920+ / any amd64 host**: build on the host with `docker compose up -d --build`
  (Container Manager on Synology can do this from the repo), OR load a
  prebuilt `linux/amd64` image tarball. Do **not** run an arm64 image on the
  DS920+.
- **Reverse proxy**: point it at container port `3456`; set `NEXTAUTH_URL` to
  the public https URL. Synology's built-in reverse proxy (Control Panel →
  Login Portal → Advanced → Reverse Proxy) works.
- **Persistence**: Postgres data lives in the `postgres_data` named volume.
  `docker compose down` keeps it; `docker compose down -v` **deletes** it.
- **Secrets**: `.env` is gitignored and must never be committed. Nothing in the
  repo contains credentials.
- **Updates**: `git pull && docker compose up -d --build`. The entrypoint
  re-syncs the schema automatically; your data volume is preserved.
