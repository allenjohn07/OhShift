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
| Frontend | Vite SPA, React, TanStack Router (file routes), Tailwind, shadcn/Radix |
| Backend | Hono, Drizzle ORM, Cloudflare D1 (SQLite) — Bun as package manager |
| Deploy | Cloudflare Pages (frontend), Cloudflare Workers (API) |

## Key paths

- Frontend routes: `src/routes/**` (thin) → page components in `src/features/**`
- Navigation: TanStack Router directly (`Link to`, `useNavigate`, `useLocation`); route paths typed as `RoutePath` in `src/lib/nav.ts`
- API client: `src/lib/rpc.ts` — typed Hono RPC (`rpc.shifts.$post({ json })`, `unwrap(call, fallback)`, `ApiData<typeof rpc.x.$get>` for response types). Backend routes declare inputs with `jsonBody<T>()` / `queryParams<K>()` (`backend/src/lib/auth-guard.ts`) so request types reach the client; the client is built in `backend/src/client.ts`
- Backend routes: `backend/src/routes/**`
- Schema: `backend/src/db/schema.ts` (Drizzle; migrations in `backend/drizzle/`)
- UI skill: `.cursor/skills/ohshift-ui/SKILL.md` — follow for frontend styling
- Live updates: `src/hooks/use-visible-poll.ts`

## Conventions

- Match existing patterns (snake_case in API JSON, camelCase in Drizzle/TS).
- D1: no interactive transactions (use `db.batch`), and a per-request query cap — batch reads instead of querying per row.
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
- Manager: `src/hooks/use-pending-time-off.ts` + badge in `src/components/app-shell.tsx` + `src/features/company/dashboard/requests/page.tsx`
- Employee: `src/features/dashboard/time-off/page.tsx`

Do **not** add WebSockets/SSE unless product explicitly asks — Workers-friendly polling is the default.

## Environment & secrets

**Never read, write, commit, or print contents of:**
- `.env`, `.env.local`, `backend/.env`
- `.dev.vars`, `backend/.dev.vars`

**Use only** `.env.example` and `backend/.env.example` as reference for variable names.

If runtime config is needed, ask the user to confirm values in their local env files — do not open those files.

**Never commit** secrets, JWT keys, database URLs, or API keys.

## Commits

The user commits. Agents **must not** run `git commit` / `git push` unless the user explicitly asks in that message. When a change is ready, give a suggested commit message and leave committing to them. See `.cursor/rules/commits.mdc`.
