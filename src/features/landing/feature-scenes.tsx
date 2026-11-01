/**
 * Small looping illustrations for the landing page (feature cards,
 * "How it works" steps and the "For teams" role cards).
 * Pure CSS animations (keyframes `scene-*` in globals.css); decorative only,
 * and frozen in their finished state when the user prefers reduced motion.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Lock,
  Send,
  Shield,
  Unlock,
  Zap,
} from "lucide-react";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

function anim(name: string, delayMs = 0): CSSProperties {
  return { animationName: name, animationDelay: `${delayMs}ms` };
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "scene relative mb-5 h-32 overflow-hidden rounded-md border border-border bg-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Avatar({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <span
      style={style}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-muted",
        getEmployeeColor(name),
        className,
      )}
    >
      {name
        .split(" ")
        .map((p) => p[0])
        .join("")}
    </span>
  );
}

/** Chips pop into a mini week grid one after another. */
function SchedulingScene() {
  const chips: Array<[number, number, string]> = [
    [0, 0, "Casey R"],
    [1, 1, "Jordan L"],
    [2, 0, "Avery P"],
    [3, 1, "Sam C"],
    [4, 0, "Taylor K"],
    [0, 1, "Taylor K"],
    [3, 0, "Casey R"],
  ];
  return (
    <Frame className="p-3">
      <div className="grid h-full grid-cols-5 gap-1.5">
        {["M", "T", "W", "T", "F"].map((d, col) => (
          <div key={col} className="flex flex-col gap-1.5">
            <span className="text-center text-[9px] font-medium text-muted-foreground">
              {d}
            </span>
            {[0, 1].map((row) => {
              const i = chips.findIndex(([c, r]) => c === col && r === row);
              return (
                <div key={row} className="h-7 rounded-sm bg-background/70">
                  {i >= 0 && (
                    <div
                      style={anim("scene-pop", i * 280)}
                      className={cn("h-full rounded-sm", getEmployeeColor(chips[i]![2]))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Mini Team panel (like the Overview's): a new teammate's row slides in. */
function TeamScene() {
  const rows: Array<[string, string, boolean?]> = [
    ["Casey R", "Barista"],
    ["Jordan L", "Cashier"],
    ["Avery P", "Shift Lead", true],
  ];
  return (
    <Frame className="flex items-center justify-center px-4">
      <div className="w-full max-w-60 overflow-hidden rounded-md border border-border bg-background">
        <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 text-[11px]">
          <span className="font-semibold">Team</span>
          <span className="text-muted-foreground tabular-nums">3</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Manage</span>
        </div>
        {rows.map(([name, role, isNew]) => (
          <div
            key={name}
            style={isNew ? anim("scene-slide-in") : undefined}
            className="flex items-center gap-2 border-b border-border px-2.5 py-1 last:border-b-0"
          >
            <Avatar name={name} className="h-5 w-5 text-[8px] ring-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-1 text-[10px] font-medium">
                {name}
                {isNew && <Shield className="h-2.5 w-2.5 text-brand" />}
              </div>
              <div className="text-[9px] text-muted-foreground">{role}</div>
            </div>
            <span className="text-[9px] text-muted-foreground">Assign</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Mini "Up next" card (like the employee Overview's) filling in. */
function PortalScene() {
  const next: Array<[string, number, string, string]> = [
    ["Mon", 2, "Morning bar", "8 am – 2 pm"],
    ["Tue", 3, "Register", "10 am – 4 pm"],
    ["Thu", 5, "Evening bar", "2 pm – 8 pm"],
  ];
  return (
    <Frame className="flex items-center justify-center px-4">
      <div className="w-full max-w-60 overflow-hidden rounded-md border border-border bg-background">
        <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Up next
          <span className="ml-auto tabular-nums">3 scheduled</span>
        </div>
        {next.map(([wd, d, title, time], i) => (
          <div
            key={wd}
            style={anim("scene-pop", i * 350)}
            className="flex items-center gap-2 border-t border-border px-2.5 py-1"
          >
            <span className="flex w-6 flex-col items-center rounded-sm border border-border leading-none">
              <span className="text-[7px] font-medium uppercase text-brand">{wd}</span>
              <span className="text-[10px] font-semibold tabular-nums">{d}</span>
            </span>
            <span className="flex-1 truncate text-[10px] font-medium">{title}</span>
            <span className="text-[9px] text-muted-foreground tabular-nums">{time}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** A change travels from the manager's screen to the employee's. */
function RealtimeScene() {
  return (
    <Frame className="flex items-center justify-between px-5">
      <div className="w-20 space-y-1 rounded-md border border-border bg-background p-2">
        <span className="text-[8px] text-muted-foreground">Manager</span>
        <div className={cn("h-3 rounded-sm", getEmployeeColor("Casey R"))} />
        <div className="h-3 rounded-sm bg-muted" />
      </div>
      <div className="relative mx-2 h-px flex-1 border-t border-dashed border-muted-foreground/40">
        <span
          style={anim("scene-travel")}
          className="absolute -top-[5px] -ml-1 h-2 w-2 rounded-full bg-brand shadow-[0_0_0_4px_var(--brand-soft)]"
        />
      </div>
      <div className="w-20 space-y-1 rounded-md border border-border bg-background p-2">
        <span className="text-[8px] text-muted-foreground">Employee</span>
        <div
          style={anim("scene-arrive")}
          className={cn("h-3 rounded-sm", getEmployeeColor("Casey R"))}
        />
        <div className="h-3 rounded-sm bg-muted" />
      </div>
    </Frame>
  );
}

/** A highlight scans the roles; each unlocks a different level of access. */
function RolesScene() {
  const rows: Array<[string, string, boolean]> = [
    ["Owner", "Everything", true],
    ["Manager", "Schedules & requests", true],
    ["Employee", "Own shifts", false],
  ];
  return (
    <Frame className="px-4 py-3">
      <div className="relative">
        <div
          style={anim("scene-scan")}
          className="absolute inset-x-0 top-0 h-[34px] rounded-sm bg-brand-soft"
        />
        {rows.map(([role, scope, open]) => (
          <div
            key={role}
            className="relative flex h-[34px] items-center gap-2 px-2 text-[11px]"
          >
            {open ? (
              <Unlock className="h-3.5 w-3.5 text-brand" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="font-medium">{role}</span>
            <span className="ml-auto text-muted-foreground">{scope}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** A lightning bolt pulses while a "saved" confirmation snaps in. */
function SpeedScene() {
  return (
    <Frame className="flex items-center justify-center gap-5">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span
          style={anim("scene-ring")}
          className="absolute inset-0 rounded-full bg-brand/30 [animation-duration:2s!important]"
        />
        <span
          style={anim("scene-ring", 1000)}
          className="absolute inset-0 rounded-full bg-brand/30 [animation-duration:2s!important]"
        />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Zap
            style={anim("scene-zap")}
            className="h-5 w-5 fill-current [animation-duration:2s!important]"
          />
        </span>
      </div>
      <div className="relative w-28 space-y-1.5 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-1.5 overflow-hidden rounded-full bg-background">
            <div
              style={anim("scene-streak", i * 220)}
              className="absolute inset-y-0 w-1/2 rounded-full bg-brand/60 [animation-duration:1.6s!important]"
            />
          </div>
        ))}
        <span
          style={anim("scene-pop", 600)}
          className="mt-1 inline-flex items-center gap-1 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
        >
          <Check className="h-3 w-3" />
          Saved
        </span>
      </div>
    </Frame>
  );
}

export const FEATURE_SCENES = {
  scheduling: SchedulingScene,
  team: TeamScene,
  portal: PortalScene,
  realtime: RealtimeScene,
  roles: RolesScene,
  speed: SpeedScene,
} as const;

export type FeatureSceneKey = keyof typeof FEATURE_SCENES;

// ── "How it works" steps ─────────────────────────────────────────────────

/** Before/after pair that swaps when the scene's "button" is pressed. */
function Swap({
  before,
  after,
  className,
}: {
  before: ReactNode;
  after: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-grid", className)}>
      <span data-swap="out" style={anim("scene-swap-out")} className="col-start-1 row-start-1">
        {before}
      </span>
      <span style={anim("scene-swap-in")} className="col-start-1 row-start-1">
        {after}
      </span>
    </span>
  );
}

/** The company name types in, then the shift presets appear. */
function CreateCompanyScene() {
  return (
    <Frame className="flex items-center justify-center">
      <div className="w-52 rounded-md border border-border bg-background p-3">
        <span className="text-[9px] text-muted-foreground">Company name</span>
        <div className="mt-1 flex h-6 items-center rounded-sm border border-brand/50 px-2 text-[11px] font-medium ring-2 ring-ring/40">
          <span
            style={{ ...anim("scene-type"), animationTimingFunction: "steps(10, end)" }}
            className="whitespace-nowrap"
          >
            Brew &amp; Co.
          </span>
          <span
            style={{ ...anim("scene-caret"), animationDuration: "1s" }}
            className="ml-px h-3 w-px bg-foreground"
          />
        </div>
        <div className="mt-2 flex gap-1">
          <span
            style={anim("scene-pop", 2400)}
            className="rounded-sm bg-[#fdecc8] px-1.5 py-0.5 text-[9px] text-[#402c1b] dark:bg-[#4a3a1a] dark:text-[#f2d9a4]"
          >
            Morning 08–16
          </span>
          <span
            style={anim("scene-pop", 2700)}
            className="rounded-sm bg-[#d3e5ef] px-1.5 py-0.5 text-[9px] text-[#183347] dark:bg-[#1f3a52] dark:text-[#b9dcf3]"
          >
            Evening 16–00
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** Mini Invite dialog: name typed, Invite pressed, the code shows in a toast. */
function InviteTeamScene() {
  return (
    <Frame className="flex items-center justify-center px-4">
      <div className="relative w-full max-w-60 rounded-md bg-background p-2.5 shadow-popover">
        <div className="mb-1.5 text-[11px] font-semibold">Invite to Brew &amp; Co.</div>
        <span className="text-[9px] text-muted-foreground">Full name</span>
        <div className="mt-0.5 flex h-5 items-center rounded-sm border border-input px-1.5 text-[10px]">
          <span
            style={{ ...anim("scene-type"), animationTimingFunction: "steps(10, end)" }}
            className="whitespace-nowrap"
          >
            Avery Park
          </span>
        </div>
        <span
          style={anim("scene-press")}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground"
        >
          <Send className="h-2.5 w-2.5" />
          Invite
        </span>
        <div
          style={anim("scene-swap-in")}
          className="absolute -bottom-1 right-2 flex items-center gap-1 rounded-md bg-popover px-2 py-1 text-[9px] shadow-popover"
        >
          <Check className="h-2.5 w-2.5 text-emerald-500" />
          Employee invited · <span className="font-mono">4C7712AF</span>
        </div>
      </div>
    </Frame>
  );
}

/** Draft shifts (dashed) become solid when Publish is pressed. */
function PublishScene() {
  const chips = ["Casey R", "Jordan L", "Avery P", "Sam C"];
  return (
    <Frame className="flex flex-col justify-center gap-2.5 px-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium">This week</span>
        <Swap
          before={
            <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
              4 drafts
            </span>
          }
          after={
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5" />
              Published
            </span>
          }
        />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {chips.map((name) => (
          <div key={name} className="relative h-8">
            <div
              data-swap="out"
              style={anim("scene-swap-out")}
              className="absolute inset-0 rounded-sm border border-dashed border-muted-foreground/50 bg-background"
            />
            <div
              style={anim("scene-swap-in")}
              className={cn("absolute inset-0 rounded-sm", getEmployeeColor(name))}
            />
          </div>
        ))}
      </div>
      <Swap
        className="self-end justify-items-end"
        before={
          <span
            style={anim("scene-press")}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[10px] font-medium text-brand-foreground"
          >
            <Send className="h-2.5 w-2.5" />
            Publish (4)
          </span>
        }
        after={
          <span className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[10px] font-medium text-brand-foreground opacity-50">
            <Send className="h-2.5 w-2.5" />
            Publish
          </span>
        }
      />
    </Frame>
  );
}

export const STEP_SCENES = [CreateCompanyScene, InviteTeamScene, PublishScene] as const;

// ── "For teams" role cards ───────────────────────────────────────────────

/** Owner changes Priya's role in Manage team; the manager shield appears. */
function OwnerScene() {
  return (
    <Frame className="flex flex-col justify-center gap-2 px-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2">
        <Avatar name="Priya P" className="h-6 w-6 text-[9px] ring-0" />
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1 text-[11px] font-medium">
            Priya Patel
            <Shield style={anim("scene-swap-in")} className="h-3 w-3 text-brand" />
          </div>
          <div className="text-[9px] text-muted-foreground">Shift Lead</div>
        </div>
        <span
          style={anim("scene-press")}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-1.5 py-0.5 text-[10px]"
        >
          <Swap
            before={<span>Employee</span>}
            after={<span className="font-medium text-brand">Manager</span>}
          />
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      </div>
      <div
        style={anim("scene-swap-in")}
        className="flex items-center gap-1.5 self-end rounded-md bg-popover px-2 py-1 text-[9px] shadow-popover"
      >
        <Check className="h-2.5 w-2.5 text-emerald-500" />
        Priya is now a manager
      </div>
    </Frame>
  );
}

/** A time-off request gets approved. */
function ManagerScene() {
  return (
    <Frame className="flex items-center justify-center px-4">
      <div className="w-full rounded-md border border-border bg-background p-2.5">
        <div className="flex items-center gap-2">
          <Avatar name="Jordan L" className="h-6 w-6 text-[9px] ring-0" />
          <div className="min-w-0 leading-tight">
            <div className="text-[11px] font-medium">Jordan Lee</div>
            <div className="text-[9px] text-muted-foreground">Vacation · Nov 5–7</div>
          </div>
        </div>
        <div className="mt-2.5 flex justify-end gap-1">
          <Swap
            before={
              <span className="flex gap-1">
                <span className="rounded-md border border-input px-2 py-0.5 text-[10px]">
                  Deny
                </span>
                <span
                  style={anim("scene-press")}
                  className="rounded-md bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground"
                >
                  Approve
                </span>
              </span>
            }
            after={
              <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Approved
              </span>
            }
            className="justify-items-end"
          />
        </div>
      </div>
    </Frame>
  );
}

/** Mini "Today" card (like the employee Overview's): Clock in → Clocked in. */
function EmployeeScene() {
  return (
    <Frame className="flex items-center justify-center px-4">
      <div className="w-full max-w-60 rounded-md border border-border bg-background p-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Today
          <span className="ml-auto rounded-sm bg-emerald-500/15 px-1 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
            Ongoing
          </span>
        </div>
        <div className="text-[12px] font-semibold">Morning bar</div>
        <div className="text-[9px] text-muted-foreground tabular-nums">9:00 AM – 3:00 PM</div>
        <div className="mt-2">
          <Swap
            className="justify-items-start"
            before={
              <span
                style={anim("scene-press")}
                className="inline-block rounded-md bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground"
              >
                Clock in
              </span>
            }
            after={
              <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span
                  style={{ ...anim("scene-blink"), animationDuration: "1.2s" }}
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                />
                Clocked in at 9:02 AM
              </span>
            }
          />
        </div>
      </div>
    </Frame>
  );
}

export const ROLE_SCENES = {
  Owners: OwnerScene,
  Managers: ManagerScene,
  Employees: EmployeeScene,
} as const;
