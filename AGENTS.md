# OhShift — Agent Guide

## Product focus

OhShift is an employee shift-scheduling platform. Build features incrementally per the roadmap phases in `.cursor/plans/`.

**Current phase (Phase 0 — no email yet):**
- Manager role assignment (owner promotes/demotes employees ↔ managers)
- Shift conflict detection (overlapping shifts for the same employee)
- Schedule publish (draft shifts visible to managers only; published shifts visible to employees)

**Deferred until domain + Brevo/Resend:** outbound email (invites, password reset, schedule notifications).

**Do not implement** unrelated features, refactors, or “while we're here” fixes unless the user explicitly asks. If you notice unrelated breakage, mention it — do not fix it in the same change unless it blocks the current task.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js (static export), React, Tailwind, shadcn/Radix |
| Backend | Bun, Elysia, Prisma, Neon PostgreSQL |
| Deploy | Cloudflare Pages (frontend), Cloudflare Workers (API) |

## Key paths

- Frontend pages: `src/app/**`
- API client: `src/lib/api.ts`
- Backend routes: `backend/src/routes/**`
- Schema: `backend/prisma/schema.prisma`
- UI skill: `.cursor/skills/ohshift-ui/SKILL.md` — follow for frontend styling
- Live updates: `src/hooks/use-visible-poll.ts`

## Conventions

- Match existing patterns (snake_case in API JSON, camelCase in Prisma/TS).
- Minimize scope — one feature vertical at a time (schema → API → UI).
- Managers and owners share manager permissions; only owners change roles.
- Managers/owners are also workers: they use Availability and Time off (same pages as employees). Another manager or the owner reviews their time-off — no self-approve.
- New shifts are **draft** until the manager publishes the week.

## Real-time updates (required when both sides change data)

Any feature where **one role writes and another role must see it without a manual refresh** must be live on **both** sides. Examples: time-off requests (employee submit ↔ manager review), future swap requests, published schedules.

### Pattern to follow

1. **Poll with `useVisiblePoll`** (`src/hooks/use-visible-poll.ts`) — ~8s while the tab is visible, plus refresh on window focus / visibility restore. Do not invent a new interval/focus loop per page.
2. **Quiet background refreshes** — toast errors on the initial load only; background polls stay silent.
3. **Optimistic local refresh after mutations** — after create / cancel / approve / deny (same tab), call the same refresh function immediately so the actor does not wait for the next poll.
4. **Shell-level sync for badges / queues** — if managers need a nav badge or shared queue (like pending Requests), mount the poller in `AppShell` and share state via a small store (`useSyncExternalStore`), same as `use-pending-time-off.ts` + `pending-time-off-store.ts`. Pages consume the store instead of one-shot fetches.
5. **Page-level sync for the other role** — employees (or whoever is not on the shell badge) use `useVisiblePoll` on the page that shows the data (e.g. Time off list).
6. **Both sides every time** — shipping only manager live updates or only employee live updates is incomplete. Wire employee + manager (or owner) in the same vertical slice.

Reference implementations:
- Manager: `src/hooks/use-pending-time-off.ts` + badge in `src/components/app-shell.tsx` + `src/app/company/dashboard/requests/page.tsx`
- Employee: `src/app/dashboard/time-off/page.tsx`

Do **not** add WebSockets/SSE unless product explicitly asks — Workers-friendly polling is the default.

## Environment & secrets

**Never read, write, commit, or print contents of:**
- `.env`, `.env.local`, `backend/.env`
- `.dev.vars`, `backend/.dev.vars`

**Use only** `.env.example` and `backend/.env.example` as reference for variable names.

If runtime config is needed, ask the user to confirm values in their local env files — do not open those files.

**Never commit** secrets, JWT keys, database URLs, or API keys.
