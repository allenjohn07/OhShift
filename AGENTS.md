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

## Conventions

- Match existing patterns (snake_case in API JSON, camelCase in Prisma/TS).
- Minimize scope — one feature vertical at a time (schema → API → UI).
- Managers and owners share manager permissions; only owners change roles.
- New shifts are **draft** until the manager publishes the week.

## Environment & secrets

**Never read, write, commit, or print contents of:**
- `.env`, `.env.local`, `backend/.env`
- `.dev.vars`, `backend/.dev.vars`

**Use only** `.env.example` and `backend/.env.example` as reference for variable names.

If runtime config is needed, ask the user to confirm values in their local env files — do not open those files.

**Never commit** secrets, JWT keys, database URLs, or API keys.
