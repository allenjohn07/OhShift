# OhShift API

Bun + [Elysia](https://elysiajs.com/) backend with [Neon](https://neon.tech/) PostgreSQL and [Prisma](https://www.prisma.io/).  
Production: [Cloudflare Workers](https://workers.cloudflare.com/) via Elysia `CloudflareAdapter`.  
Local: `bun run dev` on port 3001.

## Setup

```bash
cd backend
cp .env.example .env
# Paste Neon pooled + direct URLs; set AUTH_SECRET and FRONTEND_URL
bun install
bun run db:push    # or: bun run db:migrate
bun run dev
```

API runs at `http://localhost:3001`.

## Auth model

- **Login** — `POST /auth/login` returns a JWT (`accessToken`). The static frontend stores it in `localStorage` and sends `Authorization: Bearer <token>` on API calls.
- **Session** — `GET /auth/me` validates the token.
- Set `AUTH_SECRET` in `backend/.env` (and as a Wrangler secret in production). Configure `FRONTEND_URL` to your frontend origin for CORS.

## Routes

| Route | Purpose |
|-------|---------|
| `GET /ping` | Lightweight keep-alive |
| `GET /health` | DB connectivity check |
| `POST /auth/login` | Email/password login → JWT |
| `GET /auth/me` | Current user profile (Bearer token) |
| `POST /auth/register-company` | Public company signup |
| `POST /auth/reset-password` | Returns `tempPassword` in JSON (email deferred) |
| `POST /auth/change-password` | Authenticated password change |
| `PUT /company` | Update shift presets |
| `PUT/DELETE /employees` | Manage team |
| `POST /employees/invite` | Invite employees; returns `inviteCode` per user |
| `GET/POST/PUT/DELETE /shifts` | Shift CRUD |
| `GET /shifts/mine` | Employee's shifts (client polling) |
| `GET /dashboard/employee` | Employee dashboard data |
| `GET /dashboard/company` | Company dashboard data |
| `GET /dashboard/profile` | Profile page data |

## Cloudflare Workers deployment

1. `bunx wrangler login`
2. Set secrets (never commit these):

```bash
bunx wrangler secret put DATABASE_URL   # Neon pooled
bunx wrangler secret put DIRECT_URL     # Neon direct
bunx wrangler secret put AUTH_SECRET
bunx wrangler secret put FRONTEND_URL   # e.g. https://ohshift.pages.dev
```

3. Deploy:

```bash
bun run deploy
# or: bunx wrangler deploy
```

4. Optional local Workers preview: `bun run cf:dev` (port 8787).

`wrangler.toml` uses `nodejs_compat` and `compatibility_date` ≥ `2025-06-01` for the Elysia Cloudflare adapter.

## Email (deferred)

Outbound email is not wired. Invite codes and password-reset temps are returned in API responses for the UI to display. When you re-add email, prefer **Resend** or **Brevo** (not AWS SES if you want to avoid AWS billing).

## Frontend

The static Next.js app on Cloudflare Pages uses:

```env
NEXT_PUBLIC_API_URL=https://ohshift-api.<subdomain>.workers.dev
NEXT_PUBLIC_APP_URL=https://ohshift.pages.dev
NEXT_PUBLIC_BASE_PATH=
```

Worker secret `FRONTEND_URL` must match the Pages **origin** for CORS.
