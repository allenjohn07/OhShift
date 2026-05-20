# OhShift

Smart shift scheduling for modern teams — managers assign shifts, employees view schedules in real time.

## Architecture

| Part | Stack | Hosting |
|------|--------|---------|
| **Frontend** | Next.js (static export) | [GitHub Pages](https://pages.github.com/) |
| **API** | Bun + Elysia + Prisma | [Render](https://render.com/) |
| **Database** | PostgreSQL | [Neon](https://neon.tech/) |

## Local development

**1. Backend** (terminal 1):

```bash
cd backend
cp .env.example .env   # or copy from README in backend/
# Set DATABASE_URL, DIRECT_URL, AUTH_SECRET, SMTP_*
bun install
bun run db:push
bun run dev
```

**2. Frontend** (terminal 2):

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
# NEXT_PUBLIC_BASE_PATH=   (leave empty locally)
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy frontend (GitHub Pages)

1. Repo **Settings → Pages → Build and deployment**: Source = **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**:
   - `NEXT_PUBLIC_API_URL` — your Render API URL (e.g. `https://ohshift-api.onrender.com`)
   - `NEXT_PUBLIC_APP_URL` — your Pages URL (e.g. `https://username.github.io/OhShift`)
3. Push to `main` — workflow `.github/workflows/deploy-pages.yml` builds `out/` and deploys.

`NEXT_PUBLIC_BASE_PATH` is set automatically to `/<repo-name>` in CI.

## Deploy backend (Render)

See [backend/README.md](backend/README.md). Set `FRONTEND_URL` to your GitHub Pages URL for CORS. Use UptimeRobot on `/ping` to keep the free tier awake.

## Project structure

```
├── src/              # Next.js static frontend
├── backend/          # Bun API (all business logic + auth)
├── .github/workflows/
└── public/
```

## Features

- Company registration and team invites
- Role-based dashboards (owner / manager / employee)
- Shift assignment with email notifications
- Schedule polling (30s refresh)
