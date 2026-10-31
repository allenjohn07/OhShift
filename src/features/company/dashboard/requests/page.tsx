import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Inbox, Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader, PageMain } from "@/components/page";
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
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<PendingTimeOffType, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

const STATUS_STYLES: Record<PendingTimeOffStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  denied: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

/** Notion tag colors per time-off type. */
const TYPE_STYLES: Record<PendingTimeOffType, string> = {
  vacation: "bg-[#d3e5ef] text-[#183347] dark:bg-[#1f3a52] dark:text-[#b9dcf3]",
  sick: "bg-[#ffe2dd] text-[#5d1715] dark:bg-[#4a2321] dark:text-[#f5c2bd]",
  personal: "bg-[#e8deee] text-[#412454] dark:bg-[#3a2a4a] dark:text-[#ddc7f0]",
  other: "bg-[#e3e2e0] text-[#32302c] dark:bg-[#373737] dark:text-[#d4d4d4]",
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

function dayCount(start: string, end: string) {
  const ms =
    new Date(`${end}T00:00:00.000Z`).getTime() -
    new Date(`${start}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        getEmployeeColor(name),
      )}
    >
      {initials(name)}
    </span>
  );
}

function TypeTag({ type }: { type: PendingTimeOffType }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-xs font-medium",
        TYPE_STYLES[type],
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
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
    <PageMain>
      <PageHeader
        eyebrow={user?.profile.companies?.name ?? "Time off"}
        title="Requests"
        description="Approve or deny time-off from your team. Approved days block shifts from being assigned."
      />

      <div className="grid items-start gap-6 lg:grid-cols-5">
        {/* Pending */}
        <section className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Pending</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {pending.length}
            </span>
          </div>

          {pending.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">All caught up</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                New time-off requests from your team will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((req) => {
                const name = req.employee?.full_name ?? "Employee";
                const isOwn = Boolean(myId && req.employee_id === myId);
                const days = dayCount(req.start_date, req.end_date);
                const requested = timeAgo(req.created_at);
                return (
                  <li key={req.id} className="flex gap-3 px-4 py-4 sm:px-5">
                    <PersonAvatar name={name} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium">{name}</span>
                        {isOwn && (
                          <span className="rounded-sm bg-brand-soft px-1 text-[10px] font-medium text-brand">
                            You
                          </span>
                        )}
                        <TypeTag type={req.type} />
                        {requested && (
                          <span className="text-xs text-muted-foreground">
                            requested {requested}
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatRange(req.start_date, req.end_date)}
                        <span>· {days} day{days === 1 ? "" : "s"}</span>
                      </p>
                      {req.note && (
                        <p className="border-l-2 border-border pl-2.5 text-sm text-foreground/80">
                          {req.note}
                        </p>
                      )}
                      {isOwn ? (
                        <p className="pt-1 text-xs text-muted-foreground">
                          Another manager or the owner needs to review this.
                        </p>
                      ) : (
                        <div className="flex gap-2 pt-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actingId === req.id}
                            onClick={() => review(req.id, "denied")}
                          >
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            disabled={actingId === req.id}
                            onClick={() => review(req.id, "approved")}
                          >
                            {actingId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recently reviewed */}
        <section className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-2">
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Recently reviewed</h2>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Reviewed requests will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((req) => {
                const name = req.employee?.full_name ?? "Employee";
                return (
                  <li key={req.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <PersonAvatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TYPE_LABELS[req.type]} ·{" "}
                        {formatRange(req.start_date, req.end_date)}
                        {req.reviewed_by && ` · by ${req.reviewed_by.full_name}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[req.status],
                      )}
                    >
                      {req.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageMain>
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
