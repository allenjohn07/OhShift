import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Palmtree } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelEmpty, PanelFooter, PanelHeader } from "@/components/panel";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import type { AppRole } from "@/lib/nav";
import {
  TIME_OFF_STATUS_STYLES,
  TIME_OFF_TYPE_LABELS,
  TIME_OFF_TYPE_STYLES,
  dayCount,
  formatDateRange,
  localToday,
  type TimeOffStatus,
  type TimeOffType,
} from "@/lib/time-off";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { apiError, rpc, unwrap } from "@/lib/rpc";


type TimeOffRequest = {
  id: string;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  note: string | null;
  status: TimeOffStatus;
  created_at: string;
};

function TimeOffPageContent() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [type, setType] = useState<TimeOffType>("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const res = await rpc["time-off"].$get();
    const data = await res.json();
    if (!res.ok || "error" in data) {
      if (!opts?.quiet && res.status !== 401) {
        toast.error(apiError(data, "Failed to load time-off requests"));
      }
      return;
    }
    setRequests(data.requests);
  }, []);

  const initialLoadRef = useRef(true);
  const poll = useCallback(async () => {
    const quiet = !initialLoadRef.current;
    try {
      await load({ quiet });
    } catch {
      if (!quiet) toast.error("Failed to load time-off requests");
    } finally {
      initialLoadRef.current = false;
      setLoading(false);
    }
  }, [load]);

  useVisiblePoll(true, poll);
  const openModal = () => {
    setType("vacation");
    setStartDate("");
    setEndDate("");
    setNote("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Choose a start and end date");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }

    setSubmitting(true);
    try {
      await unwrap(
        rpc["time-off"].$post({
          json: {
            type,
            start_date: startDate,
            end_date: endDate,
            note: note.trim() || null,
          },
        }),
        "Failed to submit request",
      );
      toast.success("Time-off request submitted");
      setModalOpen(false);
      await load();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await unwrap(
        rpc["time-off"][":id"].cancel.$post({ param: { id } }),
        "Failed to cancel request",
      );
      toast.success("Request cancelled");
      await load();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel request",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const today = localToday();
  const year = String(new Date().getFullYear());
  const approved = requests.filter((r) => r.status === "approved");
  const upcomingApproved = approved
    .filter((r) => r.end_date >= today)
    .sort((x, y) => x.start_date.localeCompare(y.start_date));
  const summary = {
    pending: requests.filter((r) => r.status === "pending").length,
    upcoming: upcomingApproved.length,
    daysThisYear: approved
      .filter((r) => r.start_date.startsWith(year))
      .reduce((sum, r) => sum + dayCount(r.start_date, r.end_date), 0),
    next: upcomingApproved[0] ?? null,
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMain>
        <PageHeader
          eyebrow={user?.profile.companies?.name}
          title="Time off"
          description="Request days off and track approval status. Another manager or the owner reviews each request."
          actions={<Button onClick={openModal}>Request time off</Button>}
        />

        <div className="grid gap-6 lg:grid-cols-5">
          <Panel className="lg:col-span-3">
            <PanelHeader title="Your requests" meta={requests.length || undefined} />
            {requests.length === 0 ? (
              <PanelEmpty icon={<Palmtree />} title="No requests yet">
                Submit a request when you need days off.
              </PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {requests.map((req) => {
                  const days = dayCount(req.start_date, req.end_date);
                  return (
                    <li key={req.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.5 text-xs font-medium",
                              TIME_OFF_TYPE_STYLES[req.type],
                            )}
                          >
                            {TIME_OFF_TYPE_LABELS[req.type]}
                          </span>
                          <span className="text-sm tabular-nums">
                            {formatDateRange(req.start_date, req.end_date)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            · {days} day{days === 1 ? "" : "s"}
                          </span>
                        </div>
                        {req.note && (
                          <p className="border-l-2 border-border pl-2.5 text-sm text-foreground/80">
                            {req.note}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {req.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            disabled={cancellingId === req.id}
                            onClick={() => handleCancel(req.id)}
                          >
                            {cancellingId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Cancel"
                            )}
                          </Button>
                        )}
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize",
                            TIME_OFF_STATUS_STYLES[req.status],
                          )}
                        >
                          {req.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel className="lg:col-span-2">
            <PanelHeader title="Summary" meta={new Date().getFullYear()} />
            <dl className="grid flex-1 grid-cols-2 content-start gap-px bg-border">
              {[
                ["Pending", summary.pending, "awaiting review"],
                ["Upcoming", summary.upcoming, "approved, not taken yet"],
                ["Days off", summary.daysThisYear, "approved this year"],
                ["Requests", requests.length, "all time"],
              ].map(([label, value, hint]) => (
                <div key={label as string} className="bg-card px-4 py-3 sm:px-5">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  <dd className="text-xs text-muted-foreground">{hint}</dd>
                </div>
              ))}
            </dl>
            <PanelFooter>
              {summary.next ? (
                <>
                  Next time off:{" "}
                  <span className="font-medium text-foreground">
                    {TIME_OFF_TYPE_LABELS[summary.next.type]} ·{" "}
                    {formatDateRange(summary.next.start_date, summary.next.end_date)}
                  </span>
                </>
              ) : (
                "No approved time off coming up."
              )}
            </PanelFooter>
          </Panel>
        </div>
      </PageMain>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request time off</DialogTitle>
            <DialogDescription>
              Full days only. Your manager will approve or deny this request.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-muted-foreground">Type</label>
              <div className="flex flex-wrap gap-1 rounded-md border border-input p-1">
                {(Object.keys(TIME_OFF_TYPE_LABELS) as TimeOffType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer",
                      type === t
                        ? "bg-brand-soft text-brand"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {TIME_OFF_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="start" className="text-[13px] font-medium text-muted-foreground">
                  Start
                </label>
                <DatePicker
                  id="start"
                  required
                  value={startDate}
                  onChange={(v) => {
                    setStartDate(v);
                    if (endDate && v > endDate) setEndDate(v);
                  }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="end" className="text-[13px] font-medium text-muted-foreground">
                  End
                </label>
                <DatePicker
                  id="end"
                  required
                  value={endDate}
                  min={startDate || undefined}
                  onChange={setEndDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="note" className="text-[13px] font-medium text-muted-foreground">
                Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Anything your manager should know…"
                className={cn(fieldClass, "py-2")}
              />
            </div>

            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit request"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TimeOffPage() {
  const { user } = useAuth();
  const role: AppRole =
    user?.profile.role === "owner"
      ? "owner"
      : user?.profile.role === "manager"
        ? "manager"
        : "employee";

  return (
    <AppShell role={role}>
      {/* Owners run the workspace and don't work shifts — the guard sends them to Overview. */}
      <AuthGuard allowedRoles={["employee", "manager"]}>
        <TimeOffPageContent />
      </AuthGuard>
    </AppShell>
  );
}
