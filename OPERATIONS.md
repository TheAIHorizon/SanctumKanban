# LIVE STUDENT SITE — READ BEFORE WORK

**This application is used by students. Their work is not disposable.**

Before code, configuration, database, networking, or deployment work, read this file and the private inventory at `.ops/site.local.json`. If the inventory is missing, obtain the real target from the owner; do not guess. The inventory is intentionally gitignored because this repository is public. It contains no passwords. Keep a protected copy outside this checkout.

## Three different outcomes

1. **Local verified**: local code/build/test database only.
2. **Source published**: a GitHub commit exists; this does not deploy the NAS.
3. **Live accepted**: the actual NAS image/schema are verified AND the exact shared URL works through the user's intended access path.

Never call a local loopback preview the shared site. Never claim live success from a running container, HTTP 200 on the LAN, a different hostname, disabled TLS verification, or passing unit tests alone.

## Architecture and responsibility boundaries

```text
Browser (laptop, student computer, phone)
  -> public DNS/DDNS hostname
  -> WAN router / forwarded HTTPS port
  -> Synology HTTPS reverse proxy + assigned certificate
  -> Kanban app container (Next.js / NextAuth)
  -> PostgreSQL container on its internal Docker network
  -> persistent named database volume
```

The private inventory records the exact public URL and port, NAS LAN address, nonstandard SSH port/user, Compose project and path, container/image names, database volume, and last observed backup/revision. **Re-inspect state; recorded revisions, IPs, and counts are historical, not guarantees.**

- The observed NAS checkout is archive-based, not a Git checkout. Do not blindly run `git pull` there.
- Docker's executable can be outside a non-interactive SSH PATH; use the discovered absolute path.
- Preserve NAS-specific Compose files and environment settings. Do not overwrite them with local development versions or rotate auth secrets incidentally.
- `NEXTAUTH_URL` must remain the exact shared HTTPS origin, including its nonstandard port.
- The app container can be replaced without replacing the database volume. The database container/volume must be identified and verified, not inferred from a local Docker context.
- `docker-entrypoint.sh` runs Prisma schema synchronization at startup. **Restarting a new image can change the database.** Review the actual schema delta before any restart.
- CoyoteGPT is a separate user-owned model endpoint. It is not the website's reverse proxy or database. Check AI independently; AI failure must not block ticket work.

## Explicit prohibitions on the live site

- No demo seeds, fixture tests, `prisma migrate reset`, database drops, or volume removal.
- No `docker compose down -v`, no replacement of live data with a local/demo database.
- No unreviewed `db push --accept-data-loss`, blanket migrations, or dependency upgrades during an unrelated deployment.
- No certificates, DNS, router/NAT, firewall, auth secrets, or passwords changed incidentally while updating app code.
- No credential values, raw student records, database dumps, or `.env` contents in chat, Git, or public artifacts.
- Do not bypass TLS validation for authenticated traffic. A request using a different certificate-valid hostname is a diagnostic, not acceptance of the exact user URL.

## Preflight: inspect before changing anything

1. Confirm the authorized scope: local work, GitHub publication, or a specifically approved live deployment. A status question is not deployment consent.
2. Identify the exact URL students use and the observed failure/success in a browser. Test that URL **before** deployment; record TLS status and redirect chain.
3. Discover running image/revision, Compose project/path, mounts/volume, app and database health, and non-secret public URL configuration. Do not dump all container environment variables.
4. Record record counts and deterministic fingerprints of pre-existing business fields. Exclude credentials/session secrets and new migration fields from reported fingerprints. Counts alone cannot prove preservation.
5. Agree on the brief write pause and an abort/rollback condition. Never promise zero risk or an unverified outage duration.
6. If the exact public URL already fails, explicitly record that baseline and obtain an appropriate decision before calling a later rollout complete. Identify the layer first.

## Safe application upgrade

1. Pin the reviewed Git commit and build a **linux/amd64** candidate suitable for the NAS. Build before the outage. Preserve the old image under a rollback tag.
2. Save a protected database backup and deployment/source configuration archive outside the app directory. Verify the dump can be read and restore it into a separate rehearsal database.
3. Generate the schema difference against the actual current schema. Review every statement. Nullable-column additions are not permission to apply unrelated deletions, defaults, rewrites, or destructive changes.
4. Apply the approved delta on the restored copy. Compare pre-existing record counts and content fingerprints; exercise representative behavior without contacting the live database.
5. Pause **app writes only**, take the final consistent backup, and record a fresh baseline. Students may have changed data during the build/rehearsal.
6. Apply the reviewed schema delta; compare the baseline immediately afterward.
7. Update only the app image/source as required, preserving NAS Compose/environment configuration and the exact existing database mount. Start only the app; do not reseed.
8. Verify image revision, database schema, volume identity, existing data fingerprints, and health after startup.
9. Test login and the relevant feature through the **exact public URL**, with normal TLS verification. Inspect redirects and asset loading, not merely `/login` status.
10. Verify at least one external-network path and the user's relevant internal path. A phone on cellular and a laptop on LAN may take different routes. State any untested path or remaining blocker explicitly.
11. Keep backups and the old image. Remove only rehearsal fixtures/databases that this deployment created, after verification. Close privileged sessions when finished.

## Optional nightly reviewer

The `nightly` Compose profile adds a separate worker using the same approved app image, with no published ports and no schema-sync entrypoint. It is not enabled by a source push. Start it only after an approved schema/app deployment, then explicitly enable the intended classes. The default class setting is off; the proposed time is 02:00 America/Los_Angeles. `Queue review now` is a persisted request, not proof a worker ran. Inspect last-run/error metadata and actual saved guidance. See [the operator/user guide](docs/feedback-and-nightly-review.html). Stop the worker before a live migration or backup/write pause so its database writes do not invalidate the preservation baseline; resume only after verification. Never run fixture test scripts against student data.

## Recovery / rollback

Stop changing variables once a failure appears. Identify whether it is the app, database, TLS, routing, or browser path.

- For an application regression after an additive migration, restoring the old image while retaining unused nullable columns is often the least destructive rollback. Verify compatibility first.
- Do not automatically restore an old database over newer student writes. That requires a deliberate recovery decision and reconciliation plan.
- Do not drop newly added columns during a rollback: they may contain new student evidence.
- If an approval times out, stop that operation; do not retry it through another route. Inspect what already happened before any retry after renewed approval.

## Access incident: what was actually observed

During the September 2026 work:

- The app answered internally and authenticated guest dashboard checks passed.
- The exact public hostname failed certificate hostname verification: the assigned certificate covered the NAS's DDNS hostname, not the Kanban hostname. A certificate being assigned to a service does not add that service hostname to its Subject Alternative Names.
- The user reported access working on one computer and a phone, while a Windows computer reported **TCP connection timeout** to the public IP/HTTPS port.
- On that Windows computer, DNS returned the same public IP, and the NAS LAN HTTPS port succeeded over both Ethernet and Tailscale. The public-IP path failed over Ethernet.
- That evidence points toward internal public-IP loopback/filtering or a client/path difference. It **does not prove** the exact router cause. A certificate mismatch cannot explain a TCP timeout before TLS.
- No router/DNS/certificate fix was performed. The user later reported access working. Do not invent a resolved root cause or claim a certificate was replaced.

### Diagnose by layer

| Symptom | Next discriminating check |
|---|---|
| DNS error or differing addresses | Compare name resolution on failing and working devices |
| TCP timeout | Test exact port, interface, source address, LAN target, external/cellular path, VPN/proxy routing |
| TLS name/chain/expiry error | Inspect certificate presented with correct SNI; compare SAN coverage and service assignment |
| Redirect to wrong host/port | Inspect redirect chain and `NEXTAUTH_URL`/forwarded headers |
| Login loop or application error | Inspect session/app errors safely; test authenticated dashboard, not just static login |
| Missing new feature | Verify deployed image/revision, current schema, browser assets/cache, role and selected class |

For Windows PowerShell, run commands separately or join them with a semicolon inside a single `-Command` string. Do not concatenate two PowerShell invocations as one command. Ping success does not establish that the application's TCP port is reachable.

## Completion standard and handoff

Record: intended commit, actual deployed revision, backup location, preserved data/volume checks, migration result, authentication/feature test results, exact public-URL result, tested networks, unresolved issues, and rollback location.

Use precise language: **“app updated; public access blocked”** if that is the evidence. Do not say “ready for the GAs” until the intended path is accepted. Do not attribute every browser/network symptom to the most recently noticed certificate issue.

Keep deployment records in `.ops/` or another protected operations store. Publish generic instructions and sanitized test evidence, not private deployment metadata or student data. Update this runbook when a new procedure is proven. See [DEPLOY.md](DEPLOY.md) only for a fresh disposable installation, not as an in-place live upgrade shortcut.
