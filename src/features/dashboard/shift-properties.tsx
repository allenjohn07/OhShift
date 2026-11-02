import { Calendar, CircleDot, Clock, User } from "lucide-react";
import type { ReactNode } from "react";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/dates";

type ShiftLike = {
  start_time: string;
  end_time: string;
  status?: "draft" | "published";
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** Notion-style property list for a shift (used by the shift details dialogs). */
export function ShiftProperties({
  shift,
  assignee,
}: {
  shift: ShiftLike;
  assignee?: string | null;
}) {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const hours = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10;

  return (
    <dl className="grid grid-cols-[8rem_1fr] items-center gap-x-3 gap-y-3.5 text-sm">
      {assignee && (
        <Row icon={User} label="Assigned to">
          <span className="inline-flex items-center gap-2">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                getEmployeeColor(assignee),
              )}
            >
              {assignee
                .split(/\s+/)
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            {assignee}
          </span>
        </Row>
      )}
      <Row icon={Calendar} label="Date">
        {dateFmt.format(start)}
      </Row>
      <Row icon={Clock} label="Time">
        <span className="tabular-nums">
          {formatTime(start)} – {formatTime(end)}
        </span>
        <span className="text-muted-foreground"> · {hours}h</span>
      </Row>
      {shift.status && (
        <Row icon={CircleDot} label="Status">
          {shift.status === "draft" ? (
            <span className="inline-flex flex-col gap-1">
              <span className="w-fit rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Draft
              </span>
              <span className="text-xs text-muted-foreground">
                Not visible to employees until published
              </span>
            </span>
          ) : (
            <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Published
            </span>
          )}
        </Row>
      )}
    </dl>
  );
}
