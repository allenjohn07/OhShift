import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Send,
  Settings,
  Sparkles,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

/**
 * Static, non-interactive replica of the real owner Overview page
 * (src/features/company/dashboard/dashboard-content.tsx) for the landing hero.
 * Keep it in sync when the Overview layout changes.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** [day, time, name, title, draft?] */
const DEMO_SHIFTS: Array<[number, string, string, string, boolean?]> = [
  [0, "7 am – 3 pm", "Casey", "Opening"],
  [0, "3 pm – 11 pm", "Taylor", "Closing"],
  [1, "7 am – 3 pm", "Jordan", "Opening"],
  [1, "10 am – 6 pm", "Sam", "Register"],
  [2, "7 am – 3 pm", "Avery", "Opening"],
  [2, "3 pm – 11 pm", "Casey", "Closing"],
  [3, "7 am – 3 pm", "Taylor", "Opening"],
  [4, "7 am – 3 pm", "Sam", "Opening"],
  [4, "3 pm – 11 pm", "Jordan", "Closing"],
  [5, "9 am – 5 pm", "Avery", "Weekend", true],
  [6, "9 am – 5 pm", "Casey", "Weekend", true],
];

const NAV = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Inbox, label: "Requests", count: 2 },
  { icon: ClipboardList, label: "Timesheets" },
  { icon: Megaphone, label: "Inbox", count: 1 },
  { icon: Timer, label: "Hours" },
  { icon: Settings, label: "Settings" },
];

const STATS: Array<[string, string, string, boolean?]> = [
  ["Team", "6", "members"],
  ["Working today", "3", "people"],
  ["This week", "11", "shifts · 88h"],
  ["Drafts", "2", "not published yet", true],
];

export function SchedulePreview() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-background text-left shadow-popover"
      aria-hidden="true"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
      </div>

      <div className="flex">
        {/* Sidebar — same structure as AppShell */}
        <div className="hidden w-48 shrink-0 flex-col gap-px border-r border-border bg-sidebar p-2 md:flex">
          <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
            <BrandMark size={16} />
            <div className="leading-tight">
              <div className="text-[12px] font-semibold">Brew &amp; Co.</div>
              <div className="text-[9px] text-muted-foreground">OhShifts workspace</div>
            </div>
          </div>
          {NAV.map(({ icon: Icon, label, active, count }) => (
            <div
              key={label}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-[12px]",
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active && "text-brand")} />
              {label}
              {count ? (
                <span className="ml-auto rounded-sm bg-brand-soft px-1 text-[10px] font-medium text-brand">
                  {count}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {/* Overview page */}
        <div className="min-w-0 flex-1 space-y-4 px-4 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">
                Brew &amp; Co. · Monday, October 26
              </p>
              <p className="text-xl font-bold tracking-tight sm:text-2xl">
                Good morning, Alex
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-6 items-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium">
                <Sparkles className="h-3 w-3 text-brand" />
                Ask OhShifts
              </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium">
                <UserPlus className="h-3 w-3" />
                Invite
              </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-brand px-2 text-[11px] font-medium text-brand-foreground">
                <Users className="h-3 w-3" />
                Assign shifts
              </span>
            </div>
          </div>

          {/* At a glance */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {STATS.map(([label, value, hint, warn]) => (
              <div key={label} className="bg-background px-3 py-2">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div
                  className={cn(
                    "text-lg font-semibold leading-tight tabular-nums",
                    warn && "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {value}
                </div>
                <div className="text-[9px] text-muted-foreground">{hint}</div>
              </div>
            ))}
          </div>

          {/* Schedule card */}
          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className="text-[12px] font-semibold">Schedule</span>
              <div className="ml-auto flex items-center gap-1.5 text-[10px]">
                <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium tabular-nums">Oct 26 – Nov 1</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="inline-flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 font-medium text-brand-foreground">
                  <Send className="h-2.5 w-2.5" />
                  Publish (2)
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-7">
                {DAYS.map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      "border-b border-border py-1.5 text-center text-[10px] text-muted-foreground",
                      i > 0 && "border-l",
                    )}
                  >
                    {day}
                  </div>
                ))}
                {DAYS.map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      "min-h-[118px] space-y-1 p-1.5",
                      i > 0 && "border-l border-border",
                    )}
                  >
                    {DEMO_SHIFTS.filter(([d]) => d === i).map(
                      ([, time, name, title, draft]) => (
                        <div
                          key={name + time}
                          className={cn(
                            "rounded-sm border border-transparent px-1.5 py-1 text-[10px] leading-tight",
                            getEmployeeColor(name),
                            draft && "border-dashed border-current/40 opacity-75",
                          )}
                        >
                          <div className="font-medium">{time}</div>
                          <div className="truncate opacity-80">
                            {name}: {title}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
