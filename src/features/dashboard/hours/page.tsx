import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelEmpty, PanelHeader } from "@/components/panel";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { formatTime, clockEntriesRange, isInProgress } from "@/lib/dates";
import { queries } from "@/lib/queries";
import { rpc, unwrap } from "@/lib/rpc";
import { completeDemoStep } from "@/features/demo/tour-store";
import { Spinner } from "@/components/ui/spinner";

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

/** Stable fallbacks so memoized maps don't rebuild every render. */
const NO_SHIFTS: Shift[] = [];
const NO_ENTRIES: TimeEntry[] = [];

function HoursPageContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  // From yesterday's midnight so last night's clock-in is still found.
  const todayRange = useMemo(() => clockEntriesRange(), []);

  const headerRange = `${formatDateLabel(periodStart)} – ${formatDateLabel(periodEnd)}, ${periodEnd.getFullYear()}`;

  // Live: manager approvals and schedule changes show up without a reload.
  const shiftsQuery = useQuery(queries.myShifts());
  const entriesQuery = useQuery({
    ...queries.myEntries(periodFromIso, periodToIso),
    // Keep the old period on screen while paging to the next one.
    placeholderData: keepPreviousData,
  });
  const todayQuery = useQuery(queries.myEntries(todayRange.from, todayRange.to));
  const activeQuery = useQuery(queries.activeEntry());

  const shifts: Shift[] = shiftsQuery.data?.shifts ?? NO_SHIFTS;
  const entries: TimeEntry[] = entriesQuery.data?.entries ?? NO_ENTRIES;
  const todayEntries: TimeEntry[] = todayQuery.data?.entries ?? NO_ENTRIES;
  const active: TimeEntry | null = activeQuery.data?.entry ?? null;
  const loading = [shiftsQuery, entriesQuery, todayQuery, activeQuery].some(
    (q) => q.isPending,
  );

  // Cache today's entries so the dashboard clock card shows status instantly.
  useEffect(() => {
    const cached = [
      ...(todayQuery.data?.entries ?? []),
      ...(activeQuery.data?.entry ? [activeQuery.data.entry] : []),
    ];
    for (const entry of cached) {
      try {
        sessionStorage.setItem(
          `ohshift-time-entry:${entry.shift_id}`,
          JSON.stringify(entry),
        );
      } catch {
        /* ignore */
      }
    }
  }, [todayQuery.data, activeQuery.data]);

  /** Same-tab refresh after clock in/out. */
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["time-entries"] });


  const todayKey = toLocalDateKey(new Date());
  const todayShifts = shifts.filter(
    // Also a night shift still running from yesterday.
    (s) => toLocalDateKeyFromIso(s.start_time) === todayKey || isInProgress(s),
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
      const data = await unwrap(
        rpc["time-entries"]["clock-in"].$post({ json: { shift_id: shiftId } }),
        "Failed to clock in",
      );
      toast.success("Clocked in");
      completeDemoStep("clock-in");
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
      await refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to clock in");
    } finally {
      setActingShiftId(null);
    }
  };

  const clockOut = async (shiftId: string) => {
    setActingShiftId(shiftId);
    try {
      const data = await unwrap(
        rpc["time-entries"]["clock-out"].$post({ json: { shift_id: shiftId } }),
        "Failed to clock out",
      );
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
      await refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clock out",
      );
    } finally {
      setActingShiftId(null);
    }
  };

  const sumHours = (status: string) =>
    entries
      .filter((e) => e.status === status && e.clock_out_at)
      .reduce((sum, e) => sum + hoursBetween(e.clock_in_at, e.clock_out_at), 0);
  const periodStats: Array<[string, string | number, string]> = [
    ["Approved", formatHours(sumHours("approved")), "paid hours"],
    ["Pending", formatHours(sumHours("pending")), "awaiting review"],
    ["Entries", entries.length, "clock-ins"],
    ["Shifts today", todayShifts.length, "published"],
  ];
  const todayLabelShort = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <Spinner className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageMain>
      <PageHeader
        eyebrow={user?.profile.companies?.name}
        title="Hours"
        description="Clock in for your published shifts and review hours by week or biweekly period."
        actions={
          <Link
            to="/dashboard"
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            View schedule
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelHeader
            title="Period hours"
            meta={`${formatHours(totalHours)} total`}
            actions={
              <>
                <div className="flex gap-0.5 rounded-md border border-input p-0.5">
                  {(["week", "biweek"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMode(mode)}
                      className={cn(
                        "rounded-sm px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                        periodMode === mode
                          ? "bg-brand-soft text-brand"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode === "week" ? "Weekly" : "Biweekly"}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPeriodOffset((o) => o - 1)}
                  aria-label="Previous period"
                  tooltip="Previous period"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[8.5rem] text-center text-xs text-muted-foreground tabular-nums">
                  {headerRange}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPeriodOffset((o) => o + 1)}
                  aria-label="Next period"
                  tooltip="Next period"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            }
          />
        {entries.length === 0 ? (
          <PanelEmpty>No time entries in this period.</PanelEmpty>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
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
                    "shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-sm capitalize",
                    STATUS_STYLES[entry.status],
                  )}
                >
                  {entry.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        </Panel>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel>
            <PanelHeader title="Today" meta={todayLabelShort} />
        {todayShifts.length === 0 ? (
          <PanelEmpty icon={<Timer />}>
            No published shifts scheduled for today.
          </PanelEmpty>
        ) : (
          <ul className="divide-y divide-border">
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
                  className="px-4 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{shift.title}</p>
                      {isOpen && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Clocked in
                        </span>
                      )}
                      {entry && entry.status !== "open" && (
                        <span
                          className={cn(
                            "text-xs font-medium px-1.5 py-0.5 rounded-sm capitalize",
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
                        
                        disabled={actingShiftId === shift.id}
                        onClick={() => clockOut(shift.id)}
                      >
                        {actingShiftId === shift.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          "Clock out"
                        )}
                      </Button>
                    ) : canClockIn && earlyOk && notEnded ? (
                      <Button
                        data-tour="clock"
                        disabled={actingShiftId === shift.id}
                        onClick={() => clockIn(shift.id)}
                      >
                        {actingShiftId === shift.id ? (
                          <Spinner className="h-4 w-4" />
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
          </Panel>

          <Panel className="flex-1">
            <PanelHeader title="This period" meta={headerRange} />
            <dl className="grid flex-1 grid-cols-2 content-start gap-px bg-border">
              {periodStats.map(([label, value, hint]) => (
                <div key={label} className="bg-card px-4 py-3 sm:px-5">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  <dd className="text-xs text-muted-foreground">{hint}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </PageMain>
  );
}

export default function HoursPage() {
  const { user } = useAuth();
  const role: AppRole =
    user?.profile.role === "manager" ? "manager" : "employee";

  return (
    <AppShell role={role}>
      {/* Owners don't clock in — the guard sends them back to Overview. */}
      <AuthGuard allowedRoles={["employee", "manager"]}>
        <HoursPageContent />
      </AuthGuard>
    </AppShell>
  );
}
