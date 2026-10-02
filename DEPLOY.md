# Install your own SanctumKanban

These instructions are for a **new installation with its own database** on a computer, server or NAS. No access to the maintainer's NAS, CoyoteGPT, accounts or API keys is needed. For an existing installation with student work, follow [OPERATIONS.md](OPERATIONS.md) instead: back up, rehearse changes on a restored copy, and deploy the exact tested GitHub commit.

## 1. Prepare

Install Git and Docker with Compose v2. Allow enough disk/memory for a Next.js image build and PostgreSQL; model inference has separate hardware requirements. AI is optional and can run on another machine or an approved hosted service. See [AI setup](docs/ai-setup.md).

```bash
git clone https://github.com/TheAIHorizon/SanctumKanban.git
cd SanctumKanban
cp .env.example .env
```

Edit `.env`:

- Set `NEXTAUTH_SECRET` to a new value generated with `openssl rand -base64 32`.
- Set `POSTGRES_PASSWORD` to a strong unique password. `openssl rand -hex 24` produces one that is safe in the generated connection URL. If choosing reserved URL characters yourself, account for URL encoding in `DATABASE_URL`.
- Set `NEXTAUTH_URL` to the exact address people will visit, including HTTPS and port when applicable. For initial local testing use `http://localhost:3456`.
- Keep `.env` private. Docker assembles `DATABASE_URL` from the database settings; source development needs its own connection string.

The base Compose file publishes app port 3456 and database port 5432. For a shared deployment, remove the database `ports` mapping (containers reach `db:5432` internally), or restrict it to loopback if local database tools need it. Do not forward PostgreSQL to the internet. If another application already uses these ports/container names, adjust your new deployment configuration rather than stopping it.

## 2. Start the application

```bash
docker compose up -d --build
docker compose ps
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3456/login
```

Wait for HTTP 200. The entrypoint initializes the schema automatically. The database starts empty; there is no default login unless you deliberately run a demo seed. The entrypoint also synchronizes the schema on later starts, which is why existing-site upgrades require the operations procedure.

## 3. Create your first administrator

```bash
docker compose exec app npm run db:create-admin
```

Enter your email, first/last name and a password at the terminal prompts. Password entry is hidden; use at least 12 characters (maximum 72 UTF-8 bytes). Do not add `-T`: this command requires an interactive terminal. It creates only one administrator, refuses if any administrator exists, and never promotes or resets an existing account. Later administrators and students are managed through **Users** after sign-in.

For DCWF tasks, alignment reports and the role catalog:

```bash
docker compose exec app npm run db:import-dcwf
```

This imports bundled reference data with idempotent upserts, not student records. The first administrator can now sign in and create a class. Open **Classes**, import a CSV/Canvas roster, optionally choose **One Kanban per student**, and use **Users** to search/filter enrollment. See [roster instructions](docs/student-roster-import.md) and in-app **Help**.

### Optional disposable presentation/demo data

Use a separate, disposable installation for demos. Instead of first-admin setup, import DCWF above and run:

```bash
docker compose exec app npm run db:seed-demo
```

This creates five generated teams and 150 generated tickets, plus synthetic accounts. Demo admin: `admin@example.com` / `admin123`; generated students use `password123`. These are public sample credentials. Do not expose a seeded installation containing real records. The demo seed replaces tickets/memberships in its fixed demo teams on rerun; never use it to populate or update a student database. `db:seed` is a separate smaller sample dataset, not a production account-setup command.

## 4. Configure optional AI

Follow [AI setup](docs/ai-setup.md) for **Ollama, LM Studio/Bionic, Bionic-GPT, OmniRoute, OpenRouter, OpenAI and Anthropic**. Set all three model identifiers; models are not installed automatically. The guide explains provider keys, Docker networking, hardware choices, data handling and synthetic checks.

For new installations with assessments enabled:

```bash
docker compose -f docker-compose.yml -f docker-compose.assessments.yml up -d --build app assessments
```

The separate assessment worker is required for generated tests. Saved history and exports live in PostgreSQL. See [assessment and Canvas guide](docs/course-assessments.md). AI configuration alone does not start the worker or enable nightly reviews.

## 5. Make it available to your intended users

Use an HTTPS reverse proxy (for example Caddy, Nginx or Synology's built-in proxy) to the app on port 3456. Set `NEXTAUTH_URL` to that exact HTTPS address and assign a certificate covering its hostname. For Caddy running on the same host, an example is:

```caddyfile
kanban.example.org {
    reverse_proxy localhost:3456
}
```

Replace the example domain with yours and configure its DNS/access path. A proxy in another container must use a reachable container/service address instead of its own localhost. Verify access from the actual network your users will use.

**Board visibility:** the login page offers passwordless **Observe without signing in** access to class-visible boards. Private reports/assessments have additional authorization, but login is not a confidentiality barrier for those boards. For a restricted class deployment, put the entire site behind institution/VPN access controls and review visibility with a test account before adding private material. There is currently no documented environment switch that turns off guest observation.

For Synology or another server, match the image to its CPU architecture. An image built on Apple Silicon must be built for `linux/amd64` before using it on an x86 NAS. The repository's operations guide has the preservation and verification steps for upgrades; never copy a new Compose file over a site's private configuration blindly.

## 6. Verify and preserve

- Sign in as your new admin; create a disposable class, enroll a test user, create/edit/move a ticket and check class visibility.
- Verify the exact public URL, certificate and a normal user's login; a local login-page HTTP 200 alone is insufficient.
- If AI is enabled, use the synthetic connection check and a full invented-work assessment from [AI setup](docs/ai-setup.md).
- Try a per-team Gantt export and open Help. Validate a Canvas QTI import in your institution before assigning exams.
- Back up the database and private deployment configuration and test restoring to a separate database. Keep those backups out of Git.

PostgreSQL persists in the `postgres_data` volume. Never use `docker compose down -v` on a database you want to retain. Follow [OPERATIONS.md](OPERATIONS.md) for later updates and [CONTINUATION.md](CONTINUATION.md) for maintainer context.
