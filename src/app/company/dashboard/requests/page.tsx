"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Inbox, Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  usePendingTimeOffSnapshot,
  useRefreshPendingTimeOff,
} from "@/hooks/use-pending-time-off";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import type { AppRole } from "@/lib/nav";
import type {
  PendingTimeOffStatus,
  PendingTimeOffType,
} from "@/lib/pending-time-off-store";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<PendingTimeOffType, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

const STATUS_STYLES: Record<PendingTimeOffStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-500",
  denied: "bg-red-500/15 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  if (start === end) {
    return new Intl.DateTimeFormat("en-US", {
      ...opts,
      year: "numeric",
    }).format(s);
  }
  return `${new Intl.DateTimeFormat("en-US", opts).format(s)} – ${new Intl.DateTimeFormat("en-US", {
    ...opts,
    year: "numeric",
  }).format(e)}`;
}

function RequestsContent() {
  const api = useApi();
  const { user } = useAuth();
  const myId = user?.profile.id ?? user?.id;
  const { pending, recent, loaded } = usePendingTimeOffSnapshot();
  const refresh = useRefreshPendingTimeOff();
  const [actingId, setActingId] = useState<string | null>(null);

  const review = async (id: string, decision: "approved" | "denied") => {
    setActingId(id);
    try {
      const res = await api(`/time-off/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to update request");
      toast.success(decision === "approved" ? "Request approved" : "Request denied");
      await refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update request",
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
          Requests
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
          Approve or deny time-off from your team.
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
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              No pending time-off requests.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {pending.map((req) => {
              const isOwn = Boolean(myId && req.employee_id === myId);
              return (
                <li
                  key={req.id}
                  className="px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">
                      {req.employee?.full_name ?? "Employee"}
                      {isOwn && (
                        <span className="ml-2 text-xs font-medium text-brand">
                          You
                        </span>
                      )}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {TYPE_LABELS[req.type]} ·{" "}
                        {formatRange(req.start_date, req.end_date)}
                      </span>
                    </p>
                    {req.note && (
                      <p className="text-sm text-muted-foreground">
                        Note: {req.note}
                      </p>
                    )}
                    {isOwn && (
                      <p className="text-xs text-muted-foreground">
                        Another manager or the owner needs to review this.
                      </p>
                    )}
                  </div>
                  {isOwn ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full self-start bg-amber-500/15 text-amber-600 dark:text-amber-400 capitalize">
                      Pending
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9"
                        disabled={actingId === req.id}
                        onClick={() => review(req.id, "denied")}
                        tooltip="Deny request"
                      >
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        className="btn-brand rounded-xl h-9"
                        disabled={actingId === req.id}
                        onClick={() => review(req.id, "approved")}
                        tooltip="Approve request"
                      >
                        {actingId === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Approve"
                        )}
                      </Button>
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
          <div className="px-4 sm:px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Reviewed requests will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {recent.map((req) => (
              <li
                key={req.id}
                className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {req.employee?.full_name ?? "Employee"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {TYPE_LABELS[req.type]} ·{" "}
                      {formatRange(req.start_date, req.end_date)}
                    </span>
                  </p>
                  {req.reviewed_by && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {req.reviewed_by.full_name}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full capitalize self-start",
                    STATUS_STYLES[req.status],
                  )}
                >
                  {req.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  const role: AppRole = user?.profile.role === "owner" ? "owner" : "manager";

  return (
    <AppShell role={role}>
      <AuthGuard allowedRoles={["owner", "manager"]}>
        <RequestsContent />
      </AuthGuard>
    </AppShell>
  );
}
