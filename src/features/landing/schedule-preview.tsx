import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** [day, start, end, name, title] — static demo data for the marketing mock. */
const DEMO_SHIFTS: Array<[number, string, string, string, string]> = [
  [0, "7am", "3pm", "Casey R.", "Opening"],
  [0, "3pm", "11pm", "Taylor K.", "Closing"],
  [1, "7am", "3pm", "Jordan L.", "Opening"],
  [1, "10am", "6pm", "Sam C.", "Register"],
  [2, "7am", "3pm", "Avery P.", "Opening"],
  [2, "3pm", "11pm", "Casey R.", "Closing"],
  [3, "7am", "3pm", "Taylor K.", "Opening"],
  [4, "7am", "3pm", "Sam C.", "Opening"],
  [4, "3pm", "11pm", "Jordan L.", "Closing"],
  [5, "9am", "5pm", "Avery P.", "Weekend"],
  [6, "9am", "5pm", "Casey R.", "Weekend"],
];

const NAV = [
  { icon: LayoutGrid, label: "Overview", active: true },
  { icon: Inbox, label: "Requests", count: 2 },
  { icon: Clock, label: "Timesheets" },
  { icon: CalendarDays, label: "Availability" },
  { icon: Settings, label: "Settings" },
];

/** Static, non-interactive product screenshot for the landing page. */
export function SchedulePreview() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-background shadow-popover"
      aria-hidden="true"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
      </div>

      <div className="flex min-h-[380px]">
        {/* Sidebar */}
        <div className="hidden w-48 shrink-0 flex-col gap-px border-r border-border bg-sidebar p-2 sm:flex">
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
            <BrandMark size={16} />
            <span className="text-[13px] font-semibold">Brew &amp; Co.</span>
          </div>
          {NAV.map(({ icon: Icon, label, active, count }) => (
            <div
              key={label}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-[13px]",
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

        {/* Page */}
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-7">
          <p className="text-xs text-muted-foreground">Brew &amp; Co.</p>
          <p className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">
            Team schedule
          </p>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1 text-[13px]">
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">This week</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="rounded-md bg-brand px-2.5 py-1 text-[12px] font-medium text-brand-foreground">
              Publish
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-7 overflow-hidden rounded-lg border border-border">
              {DAYS.map((day, i) => (
                <div
                  key={day}
                  className={cn(
                    "border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground",
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
                    "min-h-[150px] space-y-1 p-1.5",
                    i > 0 && "border-l border-border",
                  )}
                >
                  {DEMO_SHIFTS.filter(([d]) => d === i).map(
                    ([, start, end, name, title]) => (
                      <div
                        key={name + start}
                        className={cn(
                          "rounded-sm px-1.5 py-1 text-[10px] leading-tight",
                          getEmployeeColor(name),
                        )}
                      >
                        <div className="font-medium">
                          {start}–{end}
                        </div>
                        <div className="opacity-80">
                          {name} · {title}
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
  );
}
