import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

type AgendaShift = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  employee_id: string;
  status?: "draft" | "published";
  users?: { full_name: string };
};

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function sameLocalDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function dayHeading(day: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameLocalDay(day, today)) return "Today";
  if (sameLocalDay(day, tomorrow)) return "Tomorrow";
  if (sameLocalDay(day, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(day);
}

/**
 * "Who's working" — one day at a time (defaults to today), with a day stepper.
 * Shifts are bucketed by the local day they start on, like the schedule grid.
 */
export function DayAgenda({
  shifts,
  currentUserId,
  className,
}: {
  shifts: AgendaShift[] | null;
  currentUserId: string;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + offset);

  const rows = (shifts ?? [])
    .filter((s) => sameLocalDay(new Date(s.start_time), day))
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );

  const now = Date.now();
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(day);

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-semibold">Who&apos;s working</h2>
          <p className="text-xs text-muted-foreground">
            {dayHeading(day)} · {dateLabel}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="mr-1 h-7 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Today
            </button>
          )}
          <IconTooltip label="Previous day" side="bottom">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </IconTooltip>
          <IconTooltip label="Next day" side="bottom">
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </IconTooltip>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-sm text-muted-foreground">
          Nobody is scheduled {offset === 0 ? "today" : "this day"}.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((shift) => {
            const name = shift.users?.full_name || "Unknown member";
            const start = new Date(shift.start_time);
            const end = new Date(shift.end_time);
            const live = start.getTime() <= now && now < end.getTime();
            const isMe = shift.employee_id === currentUserId;
            return (
              <li
                key={shift.id}
                className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    getEmployeeColor(name),
                  )}
                >
                  {name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {name}
                    {isMe && (
                      <span className="rounded-sm bg-brand-soft px-1 text-[10px] font-medium text-brand">
                        You
                      </span>
                    )}
                    {shift.status === "draft" && (
                      <span className="rounded-sm border border-dashed border-muted-foreground/40 px-1 text-[10px] font-medium text-muted-foreground">
                        Draft
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {shift.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  {live && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Now
                    </span>
                  )}
                  {timeFmt.format(start)} – {timeFmt.format(end)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
