---
name: ohshift-ui
description: >-
  OhShift product UI design system — brand purple gradient CTAs, neutral dark
  mode, layout gutters, BrandMark, auth/dashboard shells, and component
  patterns. Use when building or changing OhShift frontend UI, pages, buttons,
  themes, navbar, footer, forms, dashboards, or visual styling.
---

# OhShift UI

Follow these conventions for any frontend UI work in this repo. Prefer existing tokens and components over inventing new styles.

## Brand & color

### Logo gradient (source of truth)

Monogram: `public/logo/ohshift-os-monogram.svg`

| Stop | Hex |
|------|-----|
| From | `#6D5CFF` |
| To | `#4634D6` |

CSS vars: `--brand-from`, `--brand-to` in `src/app/globals.css`.

### Tokens

Use Tailwind theme colors from CSS vars — do not hardcode random purples.

| Token | Use |
|-------|-----|
| `brand` / `text-brand` | Labels, icons, links, accents |
| `brand-soft` / `bg-brand-soft` | Soft icon wells, subtle fills |
| `brand-foreground` | Text on brand gradient buttons |
| `primary` | Form focus / secondary brand weight |
| `ring` | Focus rings (purple-tinted) |

### Surfaces

- **Dark mode**: neutral black/gray (`oklch(... 0 0)`). Background must stay black — **no purple/blue wash** on `--background`, `--card`, `--muted`, `--border`.
- **Light mode**: soft cool-lavender tint on surfaces is OK; keep it subtle.
- Purple belongs on **CTAs, accents, focus, brand labels** — not full-page dark backgrounds.

### Semantic colors

Keep **emerald** for live/status cues (today, ongoing, success chips). Do not replace those with brand purple.

## Primary actions / buttons

Default CTAs use the logo gradient:

```css
/* globals.css — .btn-brand / .btn-primary */
background-image: linear-gradient(135deg, var(--brand-from), var(--brand-to));
```

- Default shadcn `Button` variant = `btn-brand`.
- Raw action buttons (e.g. Assign Shift): `className="... btn-brand ..."`.
- All clickable buttons use `cursor-pointer` (set globally in `globals.css` + Button base). Disabled → `cursor: not-allowed`.
- Secondary actions: `variant="secondary"` or `outline` / `ghost` — not flat navy/black fills.
- Also use `btn-hover` when you want the light opacity press feedback on non-gradient controls.

Do **not** use `bg-foreground text-background` for primary actions.

## Logo / wordmark

Use `BrandMark` from `src/components/brand-mark.tsx` beside “OhShift”:

```tsx
import { BrandMark } from "@/components/brand-mark";

<Link href="/" className="inline-flex items-center gap-1.5">
  <BrandMark size={22} />
  <span className="text-lg font-semibold tracking-tight">OhShift</span>
</Link>
```

| Placement | Size |
|-----------|------|
| Navbar / auth titles | `22` |
| Footer | `24` |

Gap between mark and title: **`gap-1.5`** (tight). Favicon: `src/app/icon.svg` + layout `icons` metadata → `/logo/ohshift-os-monogram.svg`.

## Layout gutters

Shared content width pattern (navbar, footer, dashboards, profile):

```tsx
<div className="max-w-6xl w-full mx-auto px-4 sm:px-6">
```

Always include **`w-full`** with `mx-auto` so headers don’t shrink-wrap and center.

## Page shells

### Authenticated pages (dashboard, profile)

Use `AppShell` (role-aware sidebar + mobile tabs) — not the marketing `Navbar`:

```tsx
<AppShell role="employee"> {/* or "manager" | "owner" */}
  <AuthGuard allowedRoles={["employee"]}>
    {/* page content — no Footer */}
  </AuthGuard>
</AppShell>
```

- Nav items live in `src/lib/nav.ts` — only link real routes; mark unfinished with `comingSoon`.
- Desktop: collapsible left sidebar (icon rail when collapsed; preference saved in localStorage).
- Mobile: bottom tabs + **Menu** sheet for account/extras.
- Sidebar bottom (and mobile Menu): avatar, Profile, theme toggle, Logout — not in the top bar.
- Marketing/auth pages still use `Navbar` (logged-out only). Logged-in visits to `/` redirect via `AuthHomeRedirect`.
- Loading spinner: full remaining viewport, centered:

```tsx
<div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
  <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
</div>
```

- **No footer** on authenticated pages (dashboards, profile, settings). Footer is marketing-only (`src/app/page.tsx`).

### Auth pages (login / register)

- **No footer**.
- Shell: `min-h-dvh flex flex-col`.
- Company login: center form on large screens (`items-start sm:items-center`).
- Company register: two columns on `lg+` — left: company + first/last name; right: email + password + confirm. Submit full-width below.

## Cards & chrome

- Panels: `rounded-2xl border border-border/50 bg-card/40` (or `/50`).
- Inputs: `h-10` or `h-11`, `rounded-xl`, `bg-card/50 border-border/60`.
- Icon wells: `rounded-xl bg-brand-soft text-brand` (or emerald for status).
- Workspace/company eyebrow labels: `text-sm font-medium text-brand`.

## Motion

- Entry: `animate-fade-in` + `delay-100` … `delay-400`.
- Scroll: `Reveal` / `.reveal-on-scroll`.
- Respect `prefers-reduced-motion`.

## Do / don’t

**Do**

- Reuse `Button`, `BrandMark`, `Footer`, `Navbar`, existing tokens.
- Match logo gradient on primary CTAs.
- Keep dark backgrounds neutral black.

**Don’t**

- Purple-wash the dark mode page background.
- Invent a second primary button style (flat black/navy).
- Drop `w-full` on `max-w-6xl mx-auto` headers.
- Put the global footer on login/register or any authenticated (AppShell) page.
- Unmount the navbar during page/data loading.

## Key files

| File | Role |
|------|------|
| `src/app/globals.css` | Tokens, `.btn-brand`, motion |
| `src/components/brand-mark.tsx` | Logo mark |
| `src/components/ui/button.tsx` | Default = brand gradient |
| `src/components/navbar.tsx` | Top chrome |
| `src/components/footer.tsx` | Shared footer |
| `public/logo/ohshift-os-monogram.svg` | Brand asset |
