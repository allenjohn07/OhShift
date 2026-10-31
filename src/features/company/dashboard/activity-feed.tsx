import { useCallback, useEffect, useRef, useState, useId } from "react";
import { Send, Clock, ChevronUp, ChevronRight, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { ScrollFade } from "@/components/scroll-fade";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

type PublishedShift = {
  id: string;
  title: string;
  employee_name: string;
  start_time: string;
  end_time: string;
};

type LogEntry = {
  id: string;
  action: "published";
  detail: string;
  week_start: string | null;
  created_at: string;
  actor: { full_name: string; role: string };
  shifts: PublishedShift[];
};

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateStr));
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

function formatWeek(weekStart: string | null) {
  if (!weekStart) return null;
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
  return `${fmt(start)} – ${fmt(end)}`;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function PublishedScheduleDialog({
  log,
  open,
  onOpenChange,
}: {
  log: LogEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const weekLabel = formatWeek(log.week_start);
  const count = log.shifts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {weekLabel ? `Week of ${weekLabel}` : "Published schedule"}
          </DialogTitle>
          <DialogDescription>
            Published by {log.actor.full_name}{" "}
            <span className="capitalize">({log.actor.role})</span> ·{" "}
            {timeAgo(log.created_at)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
          {count === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No shift details available.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {log.shifts.map((shift) => (
                <li
                  key={shift.id}
                  className="flex items-center justify-between gap-4 px-6 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        getEmployeeColor(shift.employee_name),
                      )}
                    >
                      {shift.employee_name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {shift.employee_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {shift.title}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    <p className="font-medium text-foreground">
                      {formatDate(shift.start_time)}
                    </p>
                    <p>
                      {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {count} shift{count !== 1 ? "s" : ""} published
          </span>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishEntry({ log, isLatest }: { log: LogEntry; isLatest: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="border-b border-border last:border-0">
        <button
          onClick={() => setModalOpen(true)}
          className="w-full px-4 sm:px-6 py-3 flex items-start gap-3 hover:bg-accent transition-colors text-left"
        >
          <div className="mt-0.5 p-1.5 rounded-lg shrink-0 bg-brand-soft text-brand">
            <Send className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm leading-snug">{log.detail}</p>
              {isLatest && (
                <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 leading-none">
                  Latest
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              by{" "}
              <span className="font-medium text-foreground">{log.actor.full_name}</span>
              {" "}
              <span className="capitalize">({log.actor.role})</span>
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="w-3 h-3" />
              {timeAgo(log.created_at)}
            </div>
            {log.shifts.length > 0 && (
              <span className="text-xs text-brand">
                {log.shifts.length} shift{log.shifts.length !== 1 ? "s" : ""} →
              </span>
            )}
          </div>
        </button>
      </div>

      <PublishedScheduleDialog
        log={log}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}

export function ActivityFeed({ refreshKey }: { refreshKey?: number }) {
  const api = useApi();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const fetchLogs = useCallback(async (showUpdating = false) => {
    if (showUpdating) setRefreshing(true);
    try {
      const res = await api("/company/activity");
      if (!res.ok) return;
      const data = await res.json();
      if (data.activity) setLogs(data.activity);
    } catch {
      // Network/CORS/5xx — keep existing list, don't throw into React.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    if (!open) return;
    fetchLogs();
  }, [open, fetchLogs]);

  const prevKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (!open) return;
    if (refreshKey !== undefined && refreshKey !== prevKeyRef.current) {
      prevKeyRef.current = refreshKey;
      fetchLogs(true);
    }
  }, [open, refreshKey, fetchLogs]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full px-4 sm:px-5 py-3 bg-card flex items-center gap-2 hover:bg-accent/60 transition-colors ${open ? "border-b border-border" : ""}`}
      >
        <h2 className="font-semibold">Published schedules</h2>
        <div className="ml-auto flex items-center gap-2">
          {refreshing && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating...
            </span>
          )}
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </button>

      {open && (
        <div id={panelId}>
          {loading ? (
            <div className="px-6 py-8 flex justify-center">
              <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No schedules published yet.
            </div>
          ) : (
            <ScrollFade contentKey={`${logs.length}:${open ? 1 : 0}`}>
              {logs.map((log, i) => (
                <PublishEntry key={log.id} log={log} isLatest={i === 0} />
              ))}
            </ScrollFade>
          )}
        </div>
      )}
    </div>
  );
}
