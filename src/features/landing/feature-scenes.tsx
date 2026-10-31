/**
 * Small looping illustrations for the landing page (feature cards,
 * "How it works" steps and the "For teams" role cards).
 * Pure CSS animations (keyframes `scene-*` in globals.css); decorative only,
 * and frozen in their finished state when the user prefers reduced motion.
 */
import type { CSSProperties, ReactNode } from "react";
import { Check, Clock, Lock, Send, Unlock, Zap } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
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

/** A new teammate slides into the avatar stack and gets a role tag. */
function TeamScene() {
  return (
    <Frame className="flex flex-col items-center justify-center gap-3">
      <div className="flex items-center -space-x-1.5">
        <Avatar name="Casey R" />
        <Avatar name="Jordan L" />
        <Avatar name="Sam C" />
        <Avatar name="Avery P" style={anim("scene-slide-in")} />
      </div>
      <span
        style={anim("scene-arrive")}
        className="rounded-sm bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand"
      >
        Avery joined as Manager
      </span>
    </Frame>
  );
}

/** A phone-sized "next shift" card with a filling progress bar. */
function PortalScene() {
  return (
    <Frame className="flex items-end justify-center pt-4">
      <div className="h-full w-40 rounded-t-lg border border-b-0 border-border bg-background px-3 pt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <BrandMark size={11} />
          <span className="text-[9px] font-semibold">Next shift</span>
        </div>
        <div className="rounded-sm bg-[#dbeddb] px-2 py-1.5 text-[9px] text-[#1c3829] dark:bg-[#1f3b2b] dark:text-[#b7e0c2]">
          <div className="font-semibold">Today · 9am–3pm</div>
          <div className="opacity-80">Morning bar</div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            style={anim("scene-fill")}
            className="h-full origin-left rounded-full bg-emerald-500"
          />
        </div>
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-20 rounded-full bg-muted" />
          <div className="h-1.5 w-14 rounded-full bg-muted" />
        </div>
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

/** Invitees appear one by one with their invite codes. */
function InviteTeamScene() {
  const rows: Array<[string, string]> = [
    ["Sam C", "7F3A21C4"],
    ["Jordan L", "B90E5D12"],
    ["Avery P", "4C7712AF"],
  ];
  return (
    <Frame className="flex items-center justify-center">
      <div className="w-56 space-y-1.5">
        {rows.map(([name, code], i) => (
          <div
            key={name}
            style={anim("scene-pop", i * 450)}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
          >
            <Avatar name={name} className="h-5 w-5 text-[8px] ring-0" />
            <span className="text-[11px] font-medium">{name}</span>
            <span className="ml-auto rounded-sm bg-muted px-1 font-mono text-[9px] text-muted-foreground">
              {code}
            </span>
            <Send className="h-3 w-3 text-brand" />
          </div>
        ))}
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
      <span
        style={anim("scene-press")}
        className="self-end rounded-md bg-brand px-2.5 py-1 text-[10px] font-medium text-brand-foreground"
      >
        Publish
      </span>
    </Frame>
  );
}

export const STEP_SCENES = [CreateCompanyScene, InviteTeamScene, PublishScene] as const;

// ── "For teams" role cards ───────────────────────────────────────────────

/** Owner flips the manager toggle; the role tag updates. */
function OwnerScene() {
  return (
    <Frame className="flex flex-col justify-center gap-2 px-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2">
        <Avatar name="Priya P" className="h-6 w-6 text-[9px] ring-0" />
        <div className="min-w-0 leading-tight">
          <div className="text-[11px] font-medium">Priya Patel</div>
          <Swap
            before={<span className="text-[9px] text-muted-foreground">Employee</span>}
            after={<span className="text-[9px] font-medium text-brand">Manager</span>}
          />
        </div>
        <span
          style={anim("scene-track")}
          className="ml-auto flex h-4 w-7 items-center rounded-full bg-input px-0.5"
        >
          <span
            style={anim("scene-knob")}
            className="h-3 w-3 rounded-full bg-white shadow-sm"
          />
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[10px]">
        <span className="text-muted-foreground">Shift presets</span>
        <span className="ml-auto font-medium tabular-nums">08–16 · 16–00</span>
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

/** The employee clocks in and goes "on shift". */
function EmployeeScene() {
  return (
    <Frame className="flex flex-col justify-center gap-2 px-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="leading-tight">
          <div className="text-[11px] font-medium">Morning bar</div>
          <div className="text-[9px] text-muted-foreground">Today · 9am–3pm</div>
        </div>
        <Swap
          className="ml-auto justify-items-end"
          before={
            <span
              style={anim("scene-press")}
              className="block rounded-md bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground"
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
              On shift
            </span>
          }
        />
      </div>
      <div className="flex items-center gap-1 px-1">
        <span className="mr-1 text-[9px] text-muted-foreground">Available</span>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-sm text-[8px]",
              i < 5 ? "bg-brand-soft text-brand" : "bg-background text-muted-foreground",
            )}
          >
            {d}
          </span>
        ))}
      </div>
    </Frame>
  );
}

export const ROLE_SCENES = {
  Owners: OwnerScene,
  Managers: ManagerScene,
  Employees: EmployeeScene,
} as const;
