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
- Data fetching / live updates: TanStack Query — `src/lib/queries.ts` (query catalogue, `LIVE_MS`), `src/hooks/use-live-badges.ts`

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

1. **Query it with TanStack Query** — add the endpoint to `queries` in `src/lib/queries.ts` with `refetchInterval: LIVE_MS` (~8s). Intervals pause in hidden tabs and refetch on window focus, so there is no per-page interval/focus loop.
2. **Quiet background refreshes** — set `meta: { errorMessage }`; the shared `QueryCache` toasts only when the *first* load fails. Background refetch errors stay silent.
3. **Refresh after mutations** — after create / cancel / approve / deny (same tab), `queryClient.invalidateQueries({ queryKey: [area] })` (or `setQueryData` for an instant local update) so the actor doesn't wait for the next poll. Keys are grouped by area (`["time-off", …]`, `["time-entries", …]`, `["dashboard", …]`) so one prefix refreshes every view of that data.
4. **Shell-level badges / queues** — hooks in `src/hooks/use-live-badges.ts` (`usePendingTimeOff`, `usePendingTimesheets`, `useInboxUnread`). `AppShell` mounts them for the nav badges; pages call the same hooks, so both read one cached query.
5. **Page-level for the other role** — employees (or whoever has no shell badge) `useQuery(queries.x())` on the page that shows the data (e.g. Time off list).
6. **Both sides every time** — shipping only manager live updates or only employee live updates is incomplete. Wire employee + manager (or owner) in the same vertical slice.
7. **Editable forms** seed local state from a query once (see Availability, Settings → Shift presets) so refetches never overwrite unsaved edits.

Reference implementations:
- Manager: `usePendingTimeOff` in `src/hooks/use-live-badges.ts` + badge in `src/components/app-shell.tsx` + `src/features/company/dashboard/requests/page.tsx`
- Employee: `src/features/dashboard/time-off/page.tsx`

Do **not** add WebSockets/SSE unless product explicitly asks — Workers-friendly polling is the default.

## Ask OhShifts assistant (`backend/src/lib/ai/`)

Read-only Q&A for every company member. **Code decides, the model assists**: it is not "ask an LLM and hope".

Flow (`ask.ts`): load team + company → **route** (`router.ts`) → role check → **executor** (`executors/*`, scoped by the JWT principal) → output guard (`redact.ts`).
- **Routing:** unsupported-action guard (`guards.ts`: "delete my shift" → where to do it) → fast paths → embedding similarity against `intents.ts` examples (bge-base) + question-shape priors (person / "my" / "who…") + topic cues → 3B model only to break ties among the top 3 → otherwise announcements knowledge fallback → otherwise a `help` result with suggestions. **Never blank.** If Workers AI is down, a lexical scorer keeps the common questions working.
- **Teach it a phrasing:** add an example to the intent in `intents.ts` (no regex edits). **Add a capability:** new intent + executor; set `roles` and `focus`.
- **Answers are built from DB facts by code.** The 3B model may only rephrase single facts / summarise announcements, and a grounding check discards anything not supported by the sources.
- **Announcements (RAG):** embeddings in `announcement_embeddings` (written on create/edit via `waitUntil`, back-filled lazily); cosine over the caller's company only. Thresholds live in `KNOWLEDGE` (`executors/announcements.ts`).
- Changes happen only through the existing UI: the assistant never writes. Managers can ask it to *draft* a shift, which they confirm in the dialog.

**Never expose to the model or in any answer** (select explicit columns; never `select()` users): password hashes, emails, invite codes, tokens, avatar URLs, direct messages, time-off notes, timesheet review notes. Employees see only published shifts and their own availability / time off / hours; manager-only intents are refused with a clear message. Every query is scoped by `principal.companyId` (from the session, never from the prompt). Announcement and name text is untrusted: it only enters prompts as quoted data.

Tests and tuning:
- `cd backend && bun test`: permissions, tenant isolation, sensitive-data canaries, injection, never-blank, router (offline). Tests swap `../db` for in-memory SQLite (`test/ai/harness.ts`).
- Live routing accuracy against real Workers AI: `bunx wrangler dev -c scripts/ai-eval/wrangler.toml --port 3098` then `curl -s localhost:3098 | bun scripts/ai-eval/report.ts` (`/knowledge` for announcement thresholds). Re-run after changing examples, cues, thresholds or the model. Keep `test/ai/phrasings.ts` honest: never copy its questions into `intents.ts` (a test enforces it).
- Per-user throttle: `AI_LIMITER` binding in `wrangler.toml` (15 / minute).
- Deploy order: apply D1 migrations (`bun run db:migrate:remote`), then deploy the Worker. Without the new table the assistant still works (announcement search degrades to keywords).

## Environment & secrets

**Never read, write, commit, or print contents of:**
- `.env`, `.env.local`, `backend/.env`
- `.dev.vars`, `backend/.dev.vars`

**Use only** `.env.example` and `backend/.env.example` as reference for variable names.

If runtime config is needed, ask the user to confirm values in their local env files — do not open those files.

**Never commit** secrets, JWT keys, database URLs, or API keys.

## Commits

The user commits. Agents **must not** run `git commit` / `git push` unless the user explicitly asks in that message. When a change is ready, give a suggested commit message and leave committing to them. See `.cursor/rules/commits.mdc`.
