# OhShift API

[Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/) with [D1](https://developers.cloudflare.com/d1/) (SQLite) via [Drizzle ORM](https://orm.drizzle.team/).
Local dev runs the real Workers runtime with `wrangler dev` on port 3001.

## Setup

```bash
cd backend
bun install
cp .env.example .dev.vars        # set AUTH_SECRET and FRONTEND_URL
bunx wrangler login              # once — Workers AI binding needs it, even locally
bun run db:migrate:local         # create tables in the local D1 (.wrangler/state)
bun run dev
```

API runs at `http://localhost:3001`.

## Database

- Schema: `src/db/schema.ts` (Drizzle). Client: `src/db/index.ts` (`db`, bound to `env.DB`).
- After changing the schema: `bun run db:generate` → new SQL file in `drizzle/` → `bun run db:migrate:local` (and `db:migrate:remote` before deploying).
- Timestamps are stored as epoch milliseconds and read as `Date`.
- D1 has no interactive transactions — use `db.batch([...])` for atomic multi-statement writes.
- D1 limits queries per request (50 on the Workers Free plan), so prefer one batched read over per-row queries (see `src/lib/assignment-context.ts`).

## Auth model

- **Login** — `POST /auth/login` returns a JWT (`accessToken`, HS256 via `hono/jwt`). The static frontend stores it in `localStorage` and sends `Authorization: Bearer <token>`.
- **Session** — `GET /auth/me` validates the token.
- **Passwords** — PBKDF2-SHA256 via Web Crypto (`src/lib/password.ts`).
- Admin recovery: `bun run set-password <email> <new-password> [--remote]`.

## Routes

| Route | Purpose |
|-------|---------|
| `GET /ping` | Lightweight keep-alive |
| `GET /health` | DB connectivity check |
| `POST /auth/login` | Email/password login → JWT |
| `GET /auth/me` | Current user profile (Bearer token) |
| `POST /auth/register-company` | Public company signup |
| `POST /auth/set-password` | Redeem a single-use account link and revoke old sessions |
| `POST /auth/reset-password` | Queues a single-use password recovery email; always returns a generic message |
| `POST /auth/change-password` | Authenticated password change |
| `PUT /company` | Update shift presets |
| `POST /company/schedule/publish` | Publish draft shifts for a week |
| `PUT/DELETE /employees` | Manage team / roles |
| `POST /employees/invite` | Email expiring account-setup links to employees |
| `GET/POST/PUT/DELETE /shifts` | Shift CRUD (`/shifts/bulk`, `/shifts/eligible`) |
| `GET /shifts/mine` | Employee's published shifts |
| `/availability`, `/time-off`, `/time-entries` | Worker availability, time off, timesheets |
| `/announcements`, `/messages`, `/inbox` | Team comms + unread counts |
| `POST /ai/parse-shift` (managers), `POST /ai/ask` (any member) | Ask OhShifts (Workers AI; see AGENTS.md) |
| `GET /dashboard/employee`, `/dashboard/company`, `/dashboard/profile` | Dashboard data |

## Cloudflare deployment

1. `bunx wrangler login`
2. Create the database once and paste the printed `database_id` into `wrangler.toml`:

```bash
bunx wrangler d1 create ohshift
```

3. Set secrets (never commit these):

```bash
bunx wrangler secret put AUTH_SECRET
bunx wrangler secret put FRONTEND_URL   # e.g. https://ohshift.pages.dev
```

4. Apply migrations and deploy:

```bash
bun run db:migrate:remote
bun run deploy
```

## Email (deferred)

Transactional email uses Resend. See [production setup](../docs/production-setup.md) for domain verification, Worker secrets and recovery behavior. Passwords and raw account-link tokens are never returned by the API.

## Frontend

The Vite SPA on Cloudflare Pages uses:

```env
VITE_API_URL=https://ohshift-api.<subdomain>.workers.dev
VITE_APP_URL=https://ohshift.pages.dev
VITE_BASE_PATH=
```

Worker secret `FRONTEND_URL` must match the Pages **origin** for CORS.
