import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Inbox, Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader, PageMain } from "@/components/page";
import { PersonAvatar } from "@/components/person-avatar";
import { Panel, PanelEmpty, PanelHeader } from "@/components/panel";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  usePendingTimeOffSnapshot,
  useRefreshPendingTimeOff,
} from "@/hooks/use-pending-time-off";
import type { AppRole } from "@/lib/nav";
import type { PendingTimeOffType } from "@/lib/pending-time-off-store";

import {
  TIME_OFF_STATUS_STYLES,
  TIME_OFF_TYPE_LABELS,
  TIME_OFF_TYPE_STYLES,
  dayCount,
  formatDateRange,
} from "@/lib/time-off";
import { cn } from "@/lib/utils";
import { rpc, unwrap } from "@/lib/rpc";

function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TypeTag({ type }: { type: PendingTimeOffType }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-xs font-medium",
        TIME_OFF_TYPE_STYLES[type],
      )}
    >
      {TIME_OFF_TYPE_LABELS[type]}
    </span>
  );
}

function RequestsContent() {
  const { user } = useAuth();
  const myId = user?.profile.id ?? user?.id;
  const { pending, recent, loaded } = usePendingTimeOffSnapshot();
  const refresh = useRefreshPendingTimeOff();
  const [actingId, setActingId] = useState<string | null>(null);

  const review = async (id: string, decision: "approved" | "denied") => {
    setActingId(id);
    try {
      await unwrap(
        rpc["time-off"][":id"].review.$post({ param: { id }, json: { decision } }),
        "Failed to update request",
      );
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

      <div className="space-y-6">
        {/* Pending */}
        <Panel>
          <PanelHeader title="Pending" meta={pending.length} />

          {pending.length === 0 ? (
            <PanelEmpty icon={<Inbox />} title="All caught up">
              New time-off requests from your team will show up here.
            </PanelEmpty>
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
                        {formatDateRange(req.start_date, req.end_date)}
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
        </Panel>

        {/* Recently reviewed */}
        <Panel>
          <PanelHeader title="Recently reviewed" meta={recent.length || undefined} />
          {recent.length === 0 ? (
            <PanelEmpty>Reviewed requests will show up here.</PanelEmpty>
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
                        {TIME_OFF_TYPE_LABELS[req.type]} ·{" "}
                        {formatDateRange(req.start_date, req.end_date)}
                        {req.reviewed_by && ` · by ${req.reviewed_by.full_name}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize",
                        TIME_OFF_STATUS_STYLES[req.status],
                      )}
                    >
                      {req.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
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
