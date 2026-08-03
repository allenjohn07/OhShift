"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Timer,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

type TimeEntryStatus = "open" | "pending" | "approved" | "denied";

type Shift = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
};

type TimeEntry = {
  id: string;
  shift_id: string;
  punched_in_at: string;
  punched_out_at: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  status: TimeEntryStatus;
  shift?: {
    title: string;
    start_time: string;
    end_time: string;
  };
};

type PeriodMode = "week" | "biweek";

const PERIOD_STORAGE_KEY = "ohshift-hours-period";

const STATUS_STYLES: Record<TimeEntryStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-500",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-500",
  denied: "bg-red-500/15 text-red-500",
};

function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalDateKeyFromIso(iso: string) {
  return toLocalDateKey(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(iso));
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatEntryDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function mondayOf(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function hoursBetween(startIso: string, endIso: string | null) {
  if (!endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

function formatHours(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function readPeriodMode(): PeriodMode {
  if (typeof window === "undefined") return "week";
  const stored = window.localStorage.getItem(PERIOD_STORAGE_KEY);
  return stored === "biweek" ? "biweek" : "week";
}

function HoursPageContent() {
  const api = useApi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingShiftId, setActingShiftId] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>(readPeriodMode);
  const [periodOffset, setPeriodOffset] = useState(0);

  const periodDays = periodMode === "week" ? 7 : 14;
  const periodStart = useMemo(() => {
    const d = mondayOf(new Date());
    d.setDate(d.getDate() + periodOffset * periodDays);
    return d;
  }, [periodOffset, periodDays]);

  const periodEnd = useMemo(() => {
    const d = new Date(periodStart);
    d.setDate(periodStart.getDate() + periodDays - 1);
    return d;
  }, [periodStart, periodDays]);

  const periodFromIso = useMemo(() => periodStart.toISOString(), [periodStart]);

  const periodToIso = useMemo(() => {
    const d = new Date(periodStart);
    d.setDate(periodStart.getDate() + periodDays);
    return d.toISOString();
  }, [periodStart, periodDays]);

  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const headerRange = `${formatDateLabel(periodStart)} – ${formatDateLabel(periodEnd)}, ${periodEnd.getFullYear()}`;

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const [shiftsRes, entriesRes, todayRes, activeRes] = await Promise.all([
        api("/shifts/mine"),
        api(
          `/time-entries/mine?from=${encodeURIComponent(periodFromIso)}&to=${encodeURIComponent(periodToIso)}`,
        ),
        api(
          `/time-entries/mine?from=${encodeURIComponent(todayRange.from)}&to=${encodeURIComponent(todayRange.to)}`,
        ),
        api("/time-entries/active"),
      ]);

      const shiftsData = await parseApiJson<{
        shifts?: Shift[];
        error?: string;
      }>(shiftsRes);
      const entriesData = await parseApiJson<{
        entries?: TimeEntry[];
        error?: string;
      }>(entriesRes);
      const todayData = await parseApiJson<{
        entries?: TimeEntry[];
        error?: string;
      }>(todayRes);
      const activeData = await parseApiJson<{
        entry?: TimeEntry | null;
        error?: string;
      }>(activeRes);

      if (!shiftsRes.ok) {
        if (!opts?.quiet && shiftsRes.status !== 401) {
          toast.error(shiftsData.error || "Failed to load shifts");
        }
        return;
      }
      if (!entriesRes.ok) {
        if (!opts?.quiet && entriesRes.status !== 401) {
          toast.error(entriesData.error || "Failed to load hours");
        }
        return;
      }
      if (!todayRes.ok) {
        if (!opts?.quiet && todayRes.status !== 401) {
          toast.error(todayData.error || "Failed to load today's hours");
        }
        return;
      }
      if (!activeRes.ok) {
        if (!opts?.quiet && activeRes.status !== 401) {
          toast.error(activeData.error || "Failed to load clock status");
        }
        return;
      }

      setShifts(shiftsData.shifts ?? []);
      setEntries(entriesData.entries ?? []);
      setTodayEntries(todayData.entries ?? []);
      setActive(activeData.entry ?? null);
      for (const entry of [
        ...(todayData.entries ?? []),
        ...(activeData.entry ? [activeData.entry] : []),
      ]) {
        try {
          sessionStorage.setItem(
            `ohshift-time-entry:${entry.shift_id}`,
            JSON.stringify(entry),
          );
        } catch {
          /* ignore */
        }
      }
    },
    [api, periodFromIso, periodToIso, todayRange.from, todayRange.to],
  );

  const initialLoadRef = useRef(true);
  const poll = useCallback(async () => {
    const quiet = !initialLoadRef.current;
    try {
      await load({ quiet });
    } catch {
      if (!quiet) toast.error("Failed to load hours");
    } finally {
      initialLoadRef.current = false;
      setLoading(false);
    }
  }, [load]);

  useVisiblePoll(true, poll);

  const todayKey = toLocalDateKey(new Date());
  const todayShifts = shifts.filter(
    (s) => toLocalDateKeyFromIso(s.start_time) === todayKey,
  );

  const entryByShift = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    for (const e of todayEntries) map.set(e.shift_id, e);
    for (const e of entries) map.set(e.shift_id, e);
    if (active) map.set(active.shift_id, active);
    return map;
  }, [todayEntries, entries, active]);

  const totalHours = entries
    .filter((e) => e.status !== "denied" && e.clock_out_at)
    .reduce((sum, e) => sum + hoursBetween(e.clock_in_at, e.clock_out_at), 0);

  const setMode = (mode: PeriodMode) => {
    setPeriodMode(mode);
    setPeriodOffset(0);
    window.localStorage.setItem(PERIOD_STORAGE_KEY, mode);
  };

  const clockIn = async (shiftId: string) => {
    setActingShiftId(shiftId);
    try {
      const res = await api("/time-entries/clock-in", {
        method: "POST",
        body: JSON.stringify({ shift_id: shiftId }),
      });
      const data = await parseApiJson<{ entry?: TimeEntry; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error || "Failed to clock in");
      toast.success("Clocked in");
      if (data.entry) {
        try {
          sessionStorage.setItem(
            `ohshift-time-entry:${shiftId}`,
            JSON.stringify(data.entry),
          );
        } catch {
          /* ignore */
        }
      }
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to clock in");
    } finally {
      setActingShiftId(null);
    }
  };

  const clockOut = async (shiftId: string) => {
    setActingShiftId(shiftId);
    try {
      const res = await api("/time-entries/clock-out", {
        method: "POST",
        body: JSON.stringify({ shift_id: shiftId }),
      });
      const data = await parseApiJson<{ entry?: TimeEntry; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error || "Failed to clock out");
      toast.success("Clocked out — pending manager approval");
      if (data.entry) {
        try {
          sessionStorage.setItem(
            `ohshift-time-entry:${shiftId}`,
            JSON.stringify(data.entry),
          );
        } catch {
          /* ignore */
        }
      }
      await load();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clock out",
      );
    } finally {
      setActingShiftId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 flex-1">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Hours</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
          Clock in for your published shifts and review hours by week or
          biweekly period.
        </p>
      </div>

      <section className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card">
          <h2 className="font-semibold">Today</h2>
        </div>

        {todayShifts.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Timer className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              No published shifts scheduled for today.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {todayShifts.map((shift) => {
              const entry = entryByShift.get(shift.id);
              const isOpen = entry?.status === "open";
              const canClockIn = !entry && !active;
              const canClockOut = isOpen;
              const now = Date.now();
              const start = new Date(shift.start_time).getTime();
              const end = new Date(shift.end_time).getTime();
              const earlyOk = now >= start - 30 * 60 * 1000;
              const notEnded = now <= end;

              return (
                <li
                  key={shift.id}
                  className="px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{shift.title}</p>
                      {isOpen && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500">
                          Clocked in
                        </span>
                      )}
                      {entry && entry.status !== "open" && (
                        <span
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-full capitalize",
                            STATUS_STYLES[entry.status],
                          )}
                        >
                          {entry.status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {formatTime(shift.start_time)} –{" "}
                        {formatTime(shift.end_time)}
                      </span>
                    </div>
                    {entry?.clock_in_at && (
                      <p className="text-xs text-muted-foreground">
                        In {formatTime(entry.clock_in_at)}
                        {entry.clock_out_at
                          ? ` · Out ${formatTime(entry.clock_out_at)} · ${formatHours(hoursBetween(entry.clock_in_at, entry.clock_out_at))}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canClockOut ? (
                      <Button
                        className="btn-brand rounded-xl h-10 px-4"
                        disabled={actingShiftId === shift.id}
                        onClick={() => clockOut(shift.id)}
                      >
                        {actingShiftId === shift.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Clock out"
                        )}
                      </Button>
                    ) : canClockIn && earlyOk && notEnded ? (
                      <Button
                        className="btn-brand rounded-xl h-10 px-4"
                        disabled={actingShiftId === shift.id}
                        onClick={() => clockIn(shift.id)}
                      >
                        {actingShiftId === shift.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Clock in"
                        )}
                      </Button>
                    ) : entry ? null : (
                      <span className="text-xs text-muted-foreground">
                        {!earlyOk
                          ? "Available 30 min before start"
                          : !notEnded
                            ? "Shift ended"
                            : active
                              ? "Clock out of your other shift first"
                              : null}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold">Period hours</h2>
            <span className="text-sm text-muted-foreground">
              {formatHours(totalHours)} total
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-xl bg-background/50 border border-border/50">
              {(["week", "biweek"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMode(mode)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                    periodMode === mode
                      ? "bg-brand-soft text-brand"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === "week" ? "Weekly" : "Biweekly"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setPeriodOffset((o) => o - 1)}
                aria-label="Previous period"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-sm text-muted-foreground min-w-[9rem] sm:min-w-[11rem] text-center">
                {headerRange}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setPeriodOffset((o) => o + 1)}
                aria-label="Next period"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No time entries in this period.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="px-4 sm:px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    {entry.shift?.title ?? "Shift"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {formatEntryDate(entry.clock_in_at)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(entry.clock_in_at)}
                    {entry.clock_out_at
                      ? ` – ${formatTime(entry.clock_out_at)}`
                      : " – …"}
                    {entry.clock_out_at
                      ? ` · ${formatHours(hoursBetween(entry.clock_in_at, entry.clock_out_at))}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full capitalize self-start",
                    STATUS_STYLES[entry.status],
                  )}
                >
                  {entry.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Need your schedule?{" "}
        <Link href="/dashboard" className="text-brand hover:underline">
          View Schedule
        </Link>
      </p>
    </main>
  );
}

export default function HoursPage() {
  const { user } = useAuth();
  const role: AppRole =
    user?.profile.role === "owner"
      ? "owner"
      : user?.profile.role === "manager"
        ? "manager"
        : "employee";

  return (
    <AppShell role={role}>
      <AuthGuard allowedRoles={["employee", "manager", "owner"]}>
        <HoursPageContent />
      </AuthGuard>
    </AppShell>
  );
}
