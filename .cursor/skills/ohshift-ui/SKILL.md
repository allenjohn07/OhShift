---
name: ohshift-ui
description: >-
  OhShift product UI design system — Notion-style neutral surfaces, flat brand
  purple CTAs, 6px/8px radii, layout gutters, BrandMark, auth/dashboard shells,
  and component patterns. Use when building or changing OhShift frontend UI, pages, buttons,
  themes, navbar, footer, forms, dashboards, or visual styling.
---

# OhShift UI

Follow these conventions for any frontend UI work in this repo. Prefer existing tokens and components over inventing new styles.

## Look & feel

Modelled on Notion: calm neutral surfaces, hairline borders, no glows or gradients, generous whitespace. The logo purple is the **only accent** — on primary buttons, links, focus rings, active nav icons and badges.

## Brand & color

Logo: `public/logo/ohshift-os-monogram.svg` (gradient `#6D5CFF → #4634D6` lives in the logo only).

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `background` | `#FFFFFF` | `#191919` | Page |
| `sidebar` / `muted` | `#F7F7F5` | `#202020` | Sidebar, banded sections, callouts |
| `foreground` | `#37352F` | `#E6E6E5` | Text |
| `muted-foreground` | `#787774` | `#9B9B9B` | Secondary text, labels |
| `border` | ink @ 9% | white @ 9% | All borders |
| `accent` | ink @ 6% | white @ 5.5% | Hover / active row fill |
| `brand` / `primary` | `#5B4BEB` | `#7A6BFF` | Primary buttons, links, active icons |
| `brand-soft` | brand @ 8% | brand @ 16% | Count badges, soft accents |
| `shadow-popover` | — | — | Dialogs, menus, tooltips only |

All defined in `src/styles/globals.css`. Do not hardcode other purples, and never tint page/card backgrounds purple.

- **Emerald** stays for live/status cues (today, ongoing, approved). **Amber** = pending. **Destructive** red for deny/delete.
- People/shift chips use Notion tag colors via `getEmployeeColor()` (`src/lib/tag-colors.ts`) — never a new palette.

## Radius & elevation

| Element | Radius |
|---------|--------|
| Buttons, inputs, selects, icon buttons, nav rows | `rounded-md` (6px) |
| Cards, panels, dialogs, menus | `rounded-lg` (8px) |
| Status tags / chips | `rounded-sm` (4px) |
| Avatars, status dots, numeric badges | `rounded-full` |

No `rounded-xl`/`rounded-2xl` on new UI, no pill-shaped buttons. Cards get a border and **no shadow**; only floating layers (dialog, dropdown, tooltip) use `shadow-popover`.

## Primary actions / buttons

- Primary = shadcn `<Button>` default variant (flat `bg-brand`, white text, 6px radius). Raw buttons may use `className="btn-brand …"` — same flat style.
- Sizes: `sm` h-7, default h-8, `lg` h-9 (hero/auth CTAs may use `h-11`).
- Secondary: `variant="outline"` (white + hairline border) or `ghost` (transparent → hover fill). Row actions in lists are `outline`/`ghost`, not brand.
- All clickable buttons use `cursor-pointer`; disabled → `cursor: not-allowed`.

## Tooltips (required)

Every interactive control must expose a hover/focus tip via `IconTooltip` (`src/components/icon-tooltip.tsx`) or `Button`’s `tooltip` prop.

| Control type | Requirement |
|--------------|-------------|
| Icon-only buttons | **Required** — short action label (e.g. “Previous week”, “Close”, “Delete shift”) |
| Icon + short label / brand CTAs | **Required** — clarify purpose (e.g. “Assign shifts to multiple people”) |
| Text-only primary/secondary actions | **Required** — same wording as the visible label is OK (e.g. “Approve request”) |
| Nav links | Collapsed rail: tooltip with page name; expanded: optional |

```tsx
import { IconTooltip } from "@/components/icon-tooltip";
import { Button } from "@/components/ui/button";

<IconTooltip label="Close" side="bottom">
  <button type="button" aria-label="Close" className="…">
    <X className="w-5 h-5" />
  </button>
</IconTooltip>

<Button size="icon" tooltip="Previous period" aria-label="Previous period">
  <ChevronLeft />
</Button>
```

- Prefer `side="bottom"` in headers, `side="top"` near footers, `side="right"` for collapsed sidebar.
- Always set `aria-label` on icon-only buttons (tooltip is not a substitute for a11y).
- Do **not** ship new buttons without a tooltip.
- Tooltips are **desktop-only** (`hover: hover` + `pointer: fine`). They stay off on phones/tablets so taps don’t sticky-open tips; `aria-label` still covers a11y.

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

Gap between mark and title: **`gap-1.5`** (tight). Favicon: `index.html` `<link rel="icon">` → `/logo/ohshift-os-monogram.svg`.

## Layout gutters

Authenticated pages: `max-w-6xl` for dashboards/grids, `max-w-4xl` for list/settings pages, with `px-4 sm:px-8 lg:px-12 pt-8 sm:pt-12`. Marketing uses `max-w-6xl px-4 sm:px-6`.

```tsx
<div className="max-w-6xl w-full mx-auto px-4 sm:px-8 lg:px-12">
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
- Desktop: Notion-style sidebar (`bg-sidebar`, workspace header with company name, 32px rows, active row = `bg-accent` + brand icon); collapsible to an icon rail (saved in localStorage).
- Mobile: bottom tabs + **Menu** sheet for account/extras.
- Sidebar bottom (and mobile Menu): avatar, Profile, theme toggle, Logout — not in the top bar.
- Marketing/auth pages still use `Navbar` (logged-out only). Logged-in visits to `/` redirect via `AuthHomeRedirect`.
- Loading spinner: full remaining viewport, centered:

```tsx
<div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
  <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
</div>
```

- **No footer** on authenticated pages (dashboards, profile, settings). Footer is marketing-only (`src/features/landing/page.tsx`).

### Auth pages (login / register)

- **No footer**.
- Shell: `min-h-dvh flex flex-col`.
- Company login: center form on large screens (`items-start sm:items-center`).
- Company register: two columns on `lg+` — left: company + first/last name; right: email + password + confirm. Submit full-width below.

## Cards & chrome

- Panels: `rounded-lg border border-border bg-card` — header row `px-4 sm:px-6 py-3 border-b border-border` with a `font-semibold` title (sentence case).
- List rows: `px-4 sm:px-6 py-3 hover:bg-accent/60`, metadata in `text-muted-foreground`.
- Status tags: `text-xs font-medium px-1.5 py-0.5 rounded-sm` + soft color fill.
- Inputs: shadcn `Input` (h-8, hairline border, brand focus ring). Labels are 13px muted.
- Stat/property tiles: small muted label with a 14px icon, value `text-2xl font-semibold`.
- Page header: optional muted eyebrow, then `h1` `text-[1.75rem] sm:text-[2.5rem] font-bold tracking-tight`.

## Modals (one design language)

Every modal uses `@/components/ui/dialog` — never a hand-rolled `fixed inset-0` overlay.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Assign shift</DialogTitle>            {/* sentence case */}
      <DialogDescription>One line of context.</DialogDescription>
    </DialogHeader>
    <form onSubmit={…} className="flex min-h-0 flex-1 flex-col">
      <DialogBody>{/* fields; scrolls */}</DialogBody>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button type="submit">Save changes</Button>      {/* primary on the right */}
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

- Header + hairline, scrollable `DialogBody`, footer bar with hairline. Close (×) comes from `DialogContent`.
- Labels: sentence case, no icons (`<Label>` or `text-[13px] font-medium text-muted-foreground`). Raw `<select>`/`<textarea>` use `fieldClass` from `@/components/ui/input`.
- Read-only details use `ShiftProperties`-style property rows (muted icon + label, value).
- Destructive actions go bottom-left (`DialogFooter className="sm:justify-between"`, ghost + `text-destructive`) and must not receive initial focus — focus the primary via `onOpenAutoFocus`.
- Multi-step modals may pin a step's footer inside the body: `<DialogFooter className="sticky -bottom-5 -mx-6 -mb-5 mt-5 bg-popover">`.
- Errors: `rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive`.

## Scrollable list panels

For any capped-height scrollable section inside a card (Team Members, Published Schedules, future queues/lists):

1. Use **`ScrollFade`** from [`src/components/scroll-fade.tsx`](src/components/scroll-fade.tsx) — do **not** invent a new fade overlay (`from-card/80` bands darken the last row).
2. Default height: `max-h-[400px]` (override with `maxHeightClass` only when needed).
3. Soft edges via **CSS mask** (content fades; no dark gradient overlay).
4. Hide the native scrollbar (built into `ScrollFade`).
5. Pass `contentKey` when the list data changes so fades recompute.
6. Keep the card header sticky outside the scroll region; only the list body scrolls.

```tsx
import { ScrollFade } from "@/components/scroll-fade";

<div className="rounded-lg border border-border bg-card overflow-hidden">
  {/* fixed header */}
  <ScrollFade contentKey={items.length} className="divide-y divide-border/40">
    {items.map(...)}
  </ScrollFade>
</div>
```

**Don’t** stack absolute `bg-gradient-to-*` overlays for vertical list fades — use `ScrollFade`.

## Landing page ↔ app consistency

The landing page illustrations are **replicas of real screens**, not invented UI:

- Hero preview (`src/features/landing/schedule-preview.tsx`) mirrors the owner Overview (`dashboard-content.tsx`): sidebar items, greeting header, at-a-glance strip, Schedule card, chip format `"7 am – 3 pm" / "Name: Title"`.
- Animated scenes (`src/features/landing/feature-scenes.tsx`) mirror Team panel, Up next / Today cards, Invite dialog, Manage-team role select, Requests approve flow, Publish (n) button.

When you change one of those app screens (labels, layout, status tags), update the matching landing replica in the same change — and vice versa.

## Motion

- Entry: `animate-fade-in` + `delay-100` … `delay-400` (subtle: 6px, 400ms).
- Scroll: `Reveal` / `.reveal-on-scroll`.
- Respect `prefers-reduced-motion`.

## Do / don’t

**Do**

- Reuse `Button`, `BrandMark`, `Footer`, `Navbar`, `ScrollFade`, existing tokens.
- Use the flat brand purple for the one primary action per area.
- Keep backgrounds neutral (white / `#191919`).

**Don’t**

- Purple-wash the dark mode page background.
- Invent a second primary button style, or bring back gradients/glow shadows.
- Use `rounded-xl`/`rounded-2xl` or pill-shaped buttons.
- Drop `w-full` on `max-w-6xl mx-auto` headers.
- Put the global footer on login/register or any authenticated (AppShell) page.
- Unmount the navbar during page/data loading.
- Hand-roll dark gradient overlays for scrollable list edges.

## Key files

| File | Role |
|------|------|
| `src/styles/globals.css` | Tokens, radius scale, `.btn-brand`, motion |
| `src/lib/tag-colors.ts` | Notion tag colors for people/shift chips |
| `src/components/brand-mark.tsx` | Logo mark |
| `src/components/scroll-fade.tsx` | Scrollable list panels with soft mask fades |
| `src/components/ui/button.tsx` | Default = flat brand purple |
| `src/components/navbar.tsx` | Top chrome |
| `src/components/footer.tsx` | Shared footer |
| `public/logo/ohshift-os-monogram.svg` | Brand asset |
