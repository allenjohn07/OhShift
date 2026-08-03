"use client";

import Link from "next/link";
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

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
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

  const endOfWeek = new Date(now);
  const daysToSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
  endOfWeek.setDate(now.getDate() + daysToSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  const upcomingShifts = shifts.filter((s) => {
    const shiftDate = toLocalDate(s.start_time);
    return shiftDate > localToday;
  });

  return (
    <>
      {todayShift ? (
        (() => {
          const status = getStatus(todayShift);
          const cfg = statusConfig[status];
          return (
            <div className="rounded-2xl border border-border/50 bg-card/40 p-6 sm:p-8 overflow-hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold">
                      Today&apos;s Shift: {todayShift.title}
                    </h2>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                    {statusReady && isOpen && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500">
                        Clocked in
                      </span>
                    )}
                    {statusReady && entry && entry.status !== "open" && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {entry.status}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{formatDate(todayShift.start_time)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        {formatTime(todayShift.start_time)} –{" "}
                        {formatTime(todayShift.end_time)}
                      </span>
                    </div>
                  </div>
                  {statusReady && entry?.clock_in_at && (
                    <p className="text-xs text-muted-foreground">
                      In {formatTime(entry.clock_in_at)}
                      {entry.clock_out_at
                        ? ` · Out ${formatTime(entry.clock_out_at)}`
                        : ""}
                    </p>
                  )}
                  <Link
                    href="/dashboard/hours"
                    className="text-sm font-medium text-brand hover:underline w-fit"
                  >
                    View all hours
                  </Link>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!statusReady ? (
                    <span className="text-xs text-muted-foreground">
                      Loading...
                    </span>
                  ) : canClockOut ? (
                    <Button
                      className="btn-brand rounded-xl h-10 px-5"
                      disabled={acting}
                      onClick={clockOut}
                      tooltip="Clock out"
                    >
                      {acting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Clock out"
                      )}
                    </Button>
                  ) : canClockIn ? (
                    <Button
                      className="btn-brand rounded-xl h-10 px-5"
                      disabled={acting}
                      onClick={clockIn}
                      tooltip="Clock in"
                    >
                      {acting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Clock in"
                      )}
                    </Button>
                  ) : entry ? null : status !== "completed" ? (
                    <span className="text-xs text-muted-foreground max-w-[12rem]">
                      {active
                        ? "Clock out of your other shift first"
                        : Date.now() <
                            new Date(todayShift.start_time).getTime() -
                              30 * 60 * 1000
                          ? "Available 30 min before start"
                          : null}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">No Shift Today</h2>
            <p className="text-muted-foreground">
              You don&apos;t have a shift scheduled for today. Enjoy your day
              off!
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold">Upcoming Shifts</h2>
          {upcomingShifts.length > 0 && (
            <span className="ml-auto text-xs font-medium bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
              {upcomingShifts.length} shift
              {upcomingShifts.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {upcomingShifts.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 text-center text-muted-foreground text-sm">
            No upcoming shifts scheduled.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {upcomingShifts.map((shift) => {
              const shiftStart = new Date(shift.start_time);
              const isThisWeek = shiftStart <= endOfWeek;

              return (
                <div
                  key={shift.id}
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium">{shift.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(shift.start_time)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <Clock className="h-3.5 w-3.5 text-emerald-500" />
                    <span>
                      {formatTime(shift.start_time)} –{" "}
                      {formatTime(shift.end_time)}
                    </span>
                    <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                      Upcoming
                    </span>
                    {isThisWeek && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                        This Week
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
