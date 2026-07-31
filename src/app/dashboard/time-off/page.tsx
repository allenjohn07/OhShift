"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Palmtree } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { Footer } from "@/components/footer";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

type TimeOffType = "vacation" | "sick" | "personal" | "other";
type TimeOffStatus = "pending" | "approved" | "denied" | "cancelled";

type TimeOffRequest = {
  id: string;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  note: string | null;
  status: TimeOffStatus;
  created_at: string;
};

const TYPE_LABELS: Record<TimeOffType, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

const STATUS_STYLES: Record<TimeOffStatus, string> = {
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

function TimeOffPageContent() {
  const api = useApi();
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
    const res = await api("/time-off");
    const data = await parseApiJson<{
      requests?: TimeOffRequest[];
      error?: string;
    }>(res);
    if (!res.ok) {
      if (!opts?.quiet && res.status !== 401) {
        toast.error(data.error || "Failed to load time-off requests");
      }
      return;
    }
    setRequests(data.requests ?? []);
  }, [api]);

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
      const res = await api("/time-off", {
        method: "POST",
        body: JSON.stringify({
          type,
          start_date: startDate,
          end_date: endDate,
          note: note.trim() || null,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
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
      const res = await api(`/time-off/${id}/cancel`, { method: "POST" });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to cancel request");
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
              Time off
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
              Request days off and track approval status. Another manager or the
              owner reviews each request.
            </p>
          </div>
          <Button
            onClick={openModal}
            className="btn-brand rounded-xl h-11 px-5 shrink-0 w-full sm:w-auto"
          >
            Request time off
          </Button>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card">
            <h2 className="font-semibold">Upcoming & past</h2>
          </div>

          {requests.length === 0 ? (
            <div className="px-4 sm:px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Palmtree className="h-6 w-6" />
              </div>
              <p className="font-medium">No requests yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Submit a request when you need days off.
              </p>
              <Button
                onClick={openModal}
                className="btn-brand rounded-xl h-11 px-5"
              >
                Request time off
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">
                        {TYPE_LABELS[req.type]}
                      </p>
                      <span className="text-muted-foreground text-sm">·</span>
                      <p className="text-sm text-muted-foreground">
                        {formatRange(req.start_date, req.end_date)}
                      </p>
                    </div>
                    {req.note && (
                      <p className="text-sm text-muted-foreground">
                        Note: {req.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full capitalize",
                        STATUS_STYLES[req.status],
                      )}
                    >
                      {req.status}
                    </span>
                    {req.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl h-8 text-muted-foreground"
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer className="mt-auto" />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request time off</DialogTitle>
            <DialogDescription>
              Full days only. Your manager will approve or deny this request.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-background/50 border border-border/50">
                {(Object.keys(TYPE_LABELS) as TimeOffType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                      type === t
                        ? "bg-brand-soft text-brand"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="start" className="text-sm font-medium">
                  Start
                </label>
                <Input
                  id="start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="h-10 rounded-xl bg-card/50 border-border/60"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="end" className="text-sm font-medium">
                  End
                </label>
                <Input
                  id="end"
                  type="date"
                  required
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 rounded-xl bg-card/50 border-border/60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">
                Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Anything your manager should know…"
                className="w-full rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="btn-brand rounded-xl"
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
      <AuthGuard allowedRoles={["employee", "manager", "owner"]}>
        <TimeOffPageContent />
      </AuthGuard>
    </AppShell>
  );
}
