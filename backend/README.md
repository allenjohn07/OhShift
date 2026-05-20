# OhShift API

Bun + [Elysia](https://elysiajs.com/) backend with [Neon](https://neon.tech/) PostgreSQL and [Prisma](https://www.prisma.io/).

## Setup

```bash
cd backend
cp .env.example .env
# Paste Neon pooled + direct URLs from the Neon dashboard
bun install
bun run db:push    # or: bun run db:migrate
bun run dev
```

API runs at `http://localhost:3001`.

## Auth model

- **Login** — `POST /auth/login` returns a JWT (`accessToken`). The static frontend stores it in `localStorage` and sends `Authorization: Bearer <token>` on API calls.
- **Session** — `GET /auth/me` validates the token.
- Set `AUTH_SECRET` in `backend/.env` (and on Render). Configure `FRONTEND_URL` to your GitHub Pages origin for CORS.

## Routes

| Route     | Purpose |
|-----------|---------|
| `GET /ping`   | Lightweight keep-alive (use for UptimeRobot / Better Stack) |
| `GET /health` | DB connectivity check |
| `POST /auth/login` | Email/password login → JWT |
| `GET /auth/me` | Current user profile (Bearer token) |
| `POST /auth/register-company` | Public company signup |
| `POST /auth/reset-password` | Email temp password |
| `POST /auth/change-password` | Authenticated password change |
| `PUT /company` | Update shift presets |
| `PUT/DELETE /employees` | Manage team |
| `POST /employees/invite` | Invite employees |
| `GET/POST/PUT/DELETE /shifts` | Shift CRUD |
| `GET /shifts/mine` | Employee's shifts (client polling) |
| `GET /dashboard/employee` | SSR employee dashboard data |
| `GET /dashboard/company` | SSR company dashboard data |
| `GET /dashboard/profile` | Profile page data |

## Render deployment

1. Create a **Web Service** on [Render](https://render.com/) connected to this repo.
2. Set **Root Directory** to `backend` (or use the root `render.yaml` and adjust paths).
3. **Build command:** `bun install && bun run build`
4. **Start command:** `bun run start`
5. Add environment variables:
   - `DATABASE_URL` — Neon **pooled** connection string
   - `DIRECT_URL` — Neon **direct** connection string (for Prisma migrations)
   - `FRONTEND_URL` — production Next.js URL (CORS)
   - `NODE_ENV=production`
6. Set **Health Check Path** to `/ping`.

Run migrations on deploy (one-time or in build):

```bash
bunx prisma migrate deploy
```

## Keep the free tier awake (no cold starts)

Render free web services sleep after **15 minutes** of no traffic. Pinging every **10–12 minutes** keeps the instance warm.

1. Deploy the API and note the public URL, e.g. `https://ohshift-api.onrender.com`.
2. In [UptimeRobot](https://uptimerobot.com/) or [Better Stack](https://betterstack.com/uptime), create an HTTP monitor:
   - **URL:** `https://your-service.onrender.com/ping`
   - **Interval:** 5 minutes (or 10 minutes — stay under 15 min)
3. Expect `200` with body like `{ "ok": true, "service": "ohshift-api", ... }`.

This uses only your free Render hours (one service 24/7 fits ~750 h/month) with zero extra cost.

## Frontend

The static Next.js app on GitHub Pages uses:

```env
NEXT_PUBLIC_API_URL=https://your-service.onrender.com
FRONTEND_URL=https://username.github.io/OhShift   # on Render (CORS)
```
