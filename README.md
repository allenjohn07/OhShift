# OhShift

Smart shift scheduling for modern teams — managers assign shifts, employees view schedules in real time.

## Architecture

| Part | Stack | Hosting |
|------|--------|---------|
| **Frontend** | Next.js (static export) | [Cloudflare Pages](https://pages.cloudflare.com/) |
| **API** | Bun + Elysia + Prisma | [Cloudflare Workers](https://workers.cloudflare.com/) (local: Bun) |
| **Database** | PostgreSQL | [Neon](https://neon.tech/) (free tier) |

Email notifications are deferred (invite codes and temp passwords show in the UI for now). Later options: Resend or Brevo.

## Local development

**1. Backend** (terminal 1):

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL, DIRECT_URL, AUTH_SECRET, FRONTEND_URL=http://localhost:3000
bun install
bun run db:push
bun run dev
```

**2. Frontend** (terminal 2):

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
# NEXT_PUBLIC_BASE_PATH=   (leave empty)
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Your setup checklist (Neon + Cloudflare)

### Neon

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy **pooled** → `DATABASE_URL` and **direct** → `DIRECT_URL` into `backend/.env`.
3. Generate `AUTH_SECRET`: `openssl rand -base64 32`.

### Local smoke test

1. Run backend + frontend as above.
2. Register a company → invite an employee → **copy the invite code from the toast** → log in as employee → assign a shift → confirm it appears on the employee dashboard.
3. Password reset shows a **temporary password in the UI** (not emailed).

### Cloudflare (production)

1. Free account at [dash.cloudflare.com](https://dash.cloudflare.com). Run `bunx wrangler login`.
2. Note **Account ID**. Create an API token (Edit Cloudflare Workers template).
3. Deploy API from `backend/`:

```bash
cd backend
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put DIRECT_URL
bunx wrangler secret put AUTH_SECRET
bun run deploy
```

Copy the Worker URL (`https://ohshift-api.<subdomain>.workers.dev`). Check `/ping` and `/health`.

4. Deploy frontend (Pages) — use **one** of these:

**A. Cloudflare dashboard (Git connected)**  
In **Settings → Builds & deployments → Build configuration**:

| Field | Value |
|-------|--------|
| Framework preset | **None** (not Next.js / OpenNext) |
| Build command | `bun install && bun run build` |
| Build output directory | `out` |
| Root directory | `/` (leave empty / repo root) |
| Deploy command | leave **empty** |

If you still see `opennextjs-cloudflare` in logs, the preset is still Next.js/OpenNext — change it to **None** and save. This app is a static export (`output: "export"`); OpenNext will always fail.

Environment variables (Production): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_PATH` (empty).

**Tip:** Prefer **one** deploy path. Either dashboard Git builds **or** GitHub Actions — not both fighting each other.

5. Set Worker secret `FRONTEND_URL` to the **Pages origin** (e.g. `https://ohshift.pages.dev`) — required for CORS.
6. Rebuild Pages if `NEXT_PUBLIC_API_URL` was missing on the first build.

See [backend/README.md](backend/README.md) for Worker details.

## Project structure

```
├── src/              # Next.js static frontend
├── backend/          # Elysia API (Bun locally, Workers in production)
├── .github/workflows/
└── public/
```

## Features

- Company registration and team invites (invite codes shown in UI)
- Role-based dashboards (owner / manager / employee)
- Shift assignment
- Schedule polling (30s refresh)
