# OhShift

Smart shift scheduling for modern teams. Create schedules, manage employees, and communicate changes — all from one clean interface.

Built with **Next.js 14** · **Tailwind CSS** · **shadcn/ui** · **Supabase** · **TypeScript**

---

## Features

- **Visual Scheduling** — Week calendar view for both employees and managers
- **Team Management** — Invite employees, assign roles, view team at a glance
- **Shift CRUD** — Create, edit, cancel shifts with instant notifications
- **Employee Dashboard** — Upcoming shifts, stats, and acknowledgement
- **Manager Overview** — Coverage stats, activity feed, today/tomorrow shifts
- **Calendar Grid** — Employee × day schedule view for managers
- **Dark Mode** — System-aware with manual toggle
- **Notifications** — In-app bell with unread count and configurable preferences

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| State | Zustand + TanStack Query |
| Email | Resend + React Email |
| Icons | Lucide React |
| Dates | date-fns |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Add your Supabase and Resend keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── login/                   # Auth pages
│   ├── signup/
│   └── (app)/                   # Authenticated routes
│       ├── dashboard/           # Employee dashboard
│       ├── schedule/            # Personal schedule
│       ├── shifts/[id]/         # Shift detail
│       ├── manage/              # Manager views
│       │   ├── schedule/        # Team calendar grid
│       │   ├── employees/       # Team management
│       │   └── shifts/          # Create/edit shifts
│       └── settings/            # Company & notification settings
├── components/
│   ├── layout/                  # Sidebar, header, theme toggle
│   ├── shifts/                  # Shift card components
│   └── ui/                      # shadcn/ui components
├── stores/                      # Zustand stores
└── lib/                         # Types, utilities, mock data
```

## Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Sign in |
| `/signup` | Public | Create account |
| `/dashboard` | Employee | Upcoming shifts & stats |
| `/schedule` | Employee | Personal week calendar |
| `/shifts/[id]` | Employee | Shift detail & acknowledge |
| `/manage` | Manager | Overview & activity |
| `/manage/schedule` | Manager | Team calendar grid |
| `/manage/employees` | Manager | Team list & invite |
| `/manage/shifts/new` | Manager | Create shift |
| `/manage/shifts/[id]/edit` | Manager | Edit shift |
| `/settings` | Owner | Company settings |
| `/settings/notifications` | All | Notification preferences |

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=noreply@ohshift.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## License

MIT
