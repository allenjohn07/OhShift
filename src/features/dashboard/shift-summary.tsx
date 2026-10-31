import { Link } from "@/lib/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

type TimeEntryStatus = "open" | "pending" | "approved" | "denied";

type TimeEntry = {
  id: string;
  shift_id: string;
  status: TimeEntryStatus;
  clock_in_at: string;
  clock_out_at: string | null;
};

function cacheKey(shiftId: string) {
  return `ohshift-time-entry:${shiftId}`;
}

function readCachedEntry(shiftId: string): TimeEntry | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(shiftId));
    if (!raw) return null;
    return JSON.parse(raw) as TimeEntry;
  } catch {
    return null;
  }
}

function writeCachedEntry(shiftId: string, entry: TimeEntry | null) {
  try {
    if (!entry) sessionStorage.removeItem(cacheKey(shiftId));
    else sessionStorage.setItem(cacheKey(shiftId), JSON.stringify(entry));
  } catch {
    // ignore quota / private mode
  }
}

/** Returns YYYY-MM-DD in the client's local timezone */
function toLocalDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(dateStr));
}

export function ShiftSummary({
  initialShifts,
}: {
  initialShifts: Shift[] | null;
  /** @deprecated kept for call-site compat; unused */
  employeeId?: string;
}) {
  const api = useApi();
  const shifts = initialShifts ?? [];
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [todayEntry, setTodayEntry] = useState<TimeEntry | null>(null);
  const [statusReady, setStatusReady] = useState(false);
  const [acting, setActing] = useState(false);

  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const todayShift =
    shifts.find((s) => toLocalDate(s.start_time) === localToday) ?? null;
  const todayShiftId = todayShift?.id ?? null;

  useEffect(() => {
    if (!todayShiftId) {
      setTodayEntry(null);
      setActive(null);
      setStatusReady(true);
      return;
    }
    const cached = readCachedEntry(todayShiftId);
    if (cached) {
      setTodayEntry(cached);
      setStatusReady(true);
    } else {
      setStatusReady(false);
    }
  }, [todayShiftId]);

  const refreshClock = useCallback(async () => {
    if (!todayShift) {
      setActive(null);
      setTodayEntry(null);
      setStatusReady(true);
      return;
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [activeRes, mineRes] = await Promise.all([
      api("/time-entries/active"),
      api(
        `/time-entries/mine?from=${encodeURIComponent(dayStart.toISOString())}&to=${encodeURIComponent(dayEnd.toISOString())}`,
      ),
    ]);

    const activeData = await parseApiJson<{ entry?: TimeEntry | null }>(
      activeRes,
    );
    const mineData = await parseApiJson<{ entries?: TimeEntry[] }>(mineRes);

    const nextActive = activeRes.ok ? (activeData.entry ?? null) : null;
    const match = mineRes.ok
      ? ((mineData.entries ?? []).find((e) => e.shift_id === todayShift.id) ??
        null)
      : null;
    const resolved =
      match ??
      (nextActive?.shift_id === todayShift.id ? nextActive : null);

    setActive(nextActive);
    setTodayEntry(resolved);
    writeCachedEntry(todayShift.id, resolved);
    setStatusReady(true);
  }, [api, todayShift]);

  useVisiblePoll(Boolean(todayShift), refreshClock);

  const entry =
    (todayShift &&
      (todayEntry?.shift_id === todayShift.id
        ? todayEntry
        : active?.shift_id === todayShift.id
          ? active
          : null)) ||
    null;
  const isOpen = entry?.status === "open";
  const canClockOut = statusReady && isOpen;
  const canClockIn =
    statusReady &&
    Boolean(todayShift) &&
    !entry &&
    !active &&
    (() => {
      if (!todayShift) return false;
      const t = Date.now();
      const start = new Date(todayShift.start_time).getTime();
      const end = new Date(todayShift.end_time).getTime();
      return t >= start - 30 * 60 * 1000 && t <= end;
    })();

  const clockIn = async () => {
    if (!todayShift) return;
    setActing(true);
    try {
      const res = await api("/time-entries/clock-in", {
        method: "POST",
        body: JSON.stringify({ shift_id: todayShift.id }),
      });
      const data = await parseApiJson<{ entry?: TimeEntry; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error || "Failed to clock in");
      toast.success("Clocked in");
      if (data.entry) {
        setTodayEntry(data.entry);
        setActive(data.entry);
        writeCachedEntry(todayShift.id, data.entry);
        setStatusReady(true);
      }
      await refreshClock();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to clock in");
    } finally {
      setActing(false);
    }
  };

  const clockOut = async () => {
    if (!todayShift) return;
    setActing(true);
    try {
      const res = await api("/time-entries/clock-out", {
        method: "POST",
        body: JSON.stringify({ shift_id: todayShift.id }),
      });
      const data = await parseApiJson<{ entry?: TimeEntry; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error || "Failed to clock out");
      toast.success("Clocked out — pending manager approval");
      if (data.entry) {
        setTodayEntry(data.entry);
        setActive(null);
        writeCachedEntry(todayShift.id, data.entry);
        setStatusReady(true);
      }
      await refreshClock();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clock out",
      );
    } finally {
      setActing(false);
    }
  };

  const getStatus = (s: Shift) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    if (now < start) return "upcoming";
    if (now > end) return "completed";
    return "ongoing";
  };

  const statusConfig = {
    completed: {
      label: "Completed",
      className: "bg-muted text-muted-foreground",
    },
    ongoing: {
      label: "Ongoing",
      className: "bg-emerald-500/15 text-emerald-500",
    },
    upcoming: {
      label: "Upcoming",
      className: "bg-blue-500/15 text-blue-400",
    },
  };

  const upcomingShifts = shifts
    .filter((s) => toLocalDate(s.start_time) > localToday)
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  const nextShifts = upcomingShifts.slice(0, 4);

  const clockAction = !statusReady ? (
    <span className="text-xs text-muted-foreground">Loading…</span>
  ) : canClockOut ? (
    <Button disabled={acting} onClick={clockOut}>
      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clock out"}
    </Button>
  ) : canClockIn ? (
    <Button disabled={acting} onClick={clockIn}>
      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clock in"}
    </Button>
  ) : null;

  const clockHint =
    todayShift && statusReady && !canClockIn && !canClockOut && !entry
      ? active
        ? "Clock out of your other shift first"
        : getStatus(todayShift) === "upcoming"
          ? "Clock-in opens 30 min before start"
          : null
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Today */}
      <section className="flex flex-col rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
          {todayShift && (
            <span
              className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded-sm ${statusConfig[getStatus(todayShift)].className}`}
            >
              {statusConfig[getStatus(todayShift)].label}
            </span>
          )}
        </div>

        {todayShift ? (
          <>
            <p className="text-xl font-semibold tracking-tight">
              {todayShift.title}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(todayShift.start_time)} –{" "}
              {formatTime(todayShift.end_time)}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              {clockAction}
              {statusReady && isOpen && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Clocked in {entry?.clock_in_at && `at ${formatTime(entry.clock_in_at)}`}
                </span>
              )}
              {statusReady && entry && entry.status !== "open" && (
                <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium capitalize text-amber-600 dark:text-amber-400">
                  {entry.status}
                  {entry.clock_out_at &&
                    ` · ${formatTime(entry.clock_in_at)}–${formatTime(entry.clock_out_at)}`}
                </span>
              )}
              {clockHint && (
                <span className="text-xs text-muted-foreground">{clockHint}</span>
              )}
              <Link
                href="/dashboard/hours"
                className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View hours →
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold tracking-tight">No shift today</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Enjoy your day off.
            </p>
            <div className="mt-auto pt-5">
              <Link
                href="/dashboard/hours"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View hours →
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Up next */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Up next</h2>
          {upcomingShifts.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {upcomingShifts.length} scheduled
            </span>
          )}
        </div>
        {nextShifts.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            No upcoming shifts yet. New shifts appear here once your manager
            publishes the schedule.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {nextShifts.map((shift) => {
              const d = new Date(shift.start_time);
              return (
                <li key={shift.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex w-9 shrink-0 flex-col items-center rounded-md border border-border py-0.5 leading-none">
                    <span className="text-[9px] font-medium uppercase text-brand">
                      {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {d.getDate()}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {shift.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
