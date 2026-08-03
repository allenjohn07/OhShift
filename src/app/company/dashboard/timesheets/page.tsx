"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  usePendingTimesheetsSnapshot,
  useRefreshPendingTimesheets,
} from "@/hooks/use-pending-timesheets";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import type { AppRole } from "@/lib/nav";
import type {
  PendingTimeEntry,
  TimeEntryStatus,
} from "@/lib/pending-timesheets-store";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TimeEntryStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-500",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-500",
  denied: "bg-red-500/15 text-red-500",
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(iso));
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

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type EditState = {
  clockIn: string;
  clockOut: string;
  note: string;
};

function TimesheetsContent() {
  const api = useApi();
  const { user } = useAuth();
  const myId = user?.profile.id ?? user?.id;
  const { pending, recent, loaded } = usePendingTimesheetsSnapshot();
  const refresh = useRefreshPendingTimesheets();
  const [actingId, setActingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});

  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const entry of pending) {
        if (!next[entry.id] && entry.clock_out_at) {
          next[entry.id] = {
            clockIn: toDatetimeLocal(entry.clock_in_at),
            clockOut: toDatetimeLocal(entry.clock_out_at),
            note: "",
          };
        }
      }
      return next;
    });
  }, [pending]);

  const review = async (
    entry: PendingTimeEntry,
    decision: "approved" | "denied",
  ) => {
    const edit = edits[entry.id];
    if (!edit) return;

    const clockInAt = fromDatetimeLocal(edit.clockIn);
    const clockOutAt = fromDatetimeLocal(edit.clockOut);
    if (!clockInAt || !clockOutAt) {
      toast.error("Enter valid clock-in and clock-out times");
      return;
    }
    if (new Date(clockOutAt) <= new Date(clockInAt)) {
      toast.error("Clock-out must be after clock-in");
      return;
    }

    setActingId(entry.id);
    try {
      const res = await api(`/time-entries/${entry.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          clock_in_at: clockInAt,
          clock_out_at: clockOutAt,
          note: edit.note.trim() || null,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to update timesheet");
      toast.success(
        decision === "approved" ? "Timesheet approved" : "Timesheet denied",
      );
      await refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update timesheet",
      );
    } finally {
      setActingId(null);
    }
  };

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 flex-1">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
          Timesheets
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
          Review clocked hours. You can adjust times before approving. You
          cannot approve your own entries.
        </p>
      </div>

      <section className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card flex items-center gap-2">
          <h2 className="font-semibold">Pending</h2>
          {pending.length > 0 && (
            <span className="text-xs font-medium bg-brand-soft text-brand px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              No pending timesheets.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {pending.map((entry) => {
              const isOwn = Boolean(myId && entry.employee_id === myId);
              const edit = edits[entry.id];
              const previewHours =
                edit &&
                formatHours(
                  hoursBetween(
                    fromDatetimeLocal(edit.clockIn) ?? entry.clock_in_at,
                    fromDatetimeLocal(edit.clockOut) ?? entry.clock_out_at,
                  ),
                );

              return (
                <li key={entry.id} className="px-4 sm:px-6 py-4 space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold">
                        {entry.employee?.full_name ?? "Employee"}
                        {isOwn && (
                          <span className="ml-2 text-xs font-medium text-brand">
                            You
                          </span>
                        )}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {entry.shift?.title ?? "Shift"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Punched {formatDateTime(entry.punched_in_at)}
                        {entry.punched_out_at
                          ? ` – ${formatTime(entry.punched_out_at)}`
                          : ""}
                        {entry.clock_out_at
                          ? ` · ${formatHours(hoursBetween(entry.clock_in_at, entry.clock_out_at))} punched`
                          : ""}
                      </p>
                      {isOwn && (
                        <p className="text-xs text-muted-foreground">
                          Another manager or the owner needs to review this.
                        </p>
                      )}
                    </div>
                    {isOwn && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full self-start bg-amber-500/15 text-amber-600 dark:text-amber-400 capitalize">
                        Pending
                      </span>
                    )}
                  </div>

                  {!isOwn && edit && (
                    <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-3 sm:p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Clock in
                          </label>
                          <Input
                            type="datetime-local"
                            value={edit.clockIn}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [entry.id]: {
                                  ...edit,
                                  clockIn: e.target.value,
                                },
                              }))
                            }
                            className="h-10 rounded-xl bg-card/50 border-border/60"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Clock out
                          </label>
                          <Input
                            type="datetime-local"
                            value={edit.clockOut}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [entry.id]: {
                                  ...edit,
                                  clockOut: e.target.value,
                                },
                              }))
                            }
                            className="h-10 rounded-xl bg-card/50 border-border/60"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Note{" "}
                          <span className="font-normal">(optional)</span>
                        </label>
                        <Input
                          value={edit.note}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [entry.id]: { ...edit, note: e.target.value },
                            }))
                          }
                          maxLength={500}
                          placeholder="Adjustment reason…"
                          className="h-10 rounded-xl bg-card/50 border-border/60"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Approving{" "}
                          <span className="font-medium text-foreground">
                            {previewHours}
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-9"
                            disabled={actingId === entry.id}
                            onClick={() => review(entry, "denied")}
                          >
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            className="btn-brand rounded-xl h-9"
                            disabled={actingId === entry.id}
                            onClick={() => review(entry, "approved")}
                          >
                            {actingId === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card">
          <h2 className="font-semibold">Recent</h2>
        </div>

        {recent.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No reviewed timesheets yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {recent.map((entry) => (
              <li
                key={entry.id}
                className="px-4 sm:px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    {entry.employee?.full_name ?? "Employee"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {entry.shift?.title ?? "Shift"} ·{" "}
                      {formatDateTime(entry.clock_in_at)}
                      {entry.clock_out_at
                        ? ` – ${formatTime(entry.clock_out_at)}`
                        : ""}
                      {entry.clock_out_at
                        ? ` · ${formatHours(hoursBetween(entry.clock_in_at, entry.clock_out_at))}`
                        : ""}
                    </span>
                  </p>
                  {entry.reviewed_by && (
                    <p className="text-xs text-muted-foreground">
                      Reviewed by {entry.reviewed_by.full_name}
                    </p>
                  )}
                  {entry.review_note && (
                    <p className="text-xs text-muted-foreground">
                      Note: {entry.review_note}
                    </p>
                  )}
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
    </main>
  );
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const role: AppRole =
    user?.profile.role === "owner" ? "owner" : "manager";

  return (
    <AppShell role={role}>
      <AuthGuard allowedRoles={["manager", "owner"]}>
        <TimesheetsContent />
      </AuthGuard>
    </AppShell>
  );
}
