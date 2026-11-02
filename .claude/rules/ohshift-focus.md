# OhShift — Focused work only

Read `AGENTS.md` at the repo root for product context and current phase.

## Scope rules

1. Implement only what the user asked for in the current task. Do not add unrelated features, drive-by refactors, or “improvements” outside scope.
2. If you spot unrelated bugs or tech debt, note them briefly — do not fix unless the user asks or the bug blocks your task.
3. Follow the phased roadmap: Phase 0 (foundations, no email) → Phase 1 (availability, PTO, templates, swaps) → later phases. Do not jump ahead.
4. Transactional email uses Resend. Invitation and recovery links are single-use and expire; never expose credentials in the API/UI. See `docs/production-setup.md`.
5. One vertical slice per change: Drizzle schema (backend/src/db/schema.ts) → backend route → frontend UI → behavioral tests → verification.

## Code style

- Reuse existing helpers (`auth-guard`, `serialize`, `useApi`, dashboard patterns).
- Managers/owners also get Availability + Time off (self-service); no self-approve on Requests.
- Cross-user live data: follow **Real-time updates** in `AGENTS.md` — TanStack Query with `LIVE_MS` (`src/lib/queries.ts`), wire **both** employee and manager sides, refresh after mutations.
- Frontend UI: follow `.claude/skills/ohshift-ui/SKILL.md`.
- Keep diffs small and focused.

## Commits

Do not auto-commit or push. When done, give a copy-paste commit message; the user commits. See `.claude/rules/commits.md`.
