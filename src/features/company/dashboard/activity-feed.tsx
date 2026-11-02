import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { Panel, PanelEmpty, PanelHeader } from "@/components/panel";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/dates";

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

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

function formatWeek(weekStart: string | null) {
  if (!weekStart) return null;
  // YYYY-MM-DD is a local calendar date — parse as local midnight, not UTC.
  const start = new Date(`${weekStart}T00:00:00`);
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
  const week = formatWeek(log.week_start);
  const count = log.shifts.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60 sm:px-5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Send className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{week ? `Week of ${week}` : "Schedule published"}</span>
            {isLatest && (
              <span className="shrink-0 rounded-sm bg-emerald-500/15 px-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Latest
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {count} shift{count !== 1 ? "s" : ""} · {log.actor.full_name} ·{" "}
            {timeAgo(log.created_at)}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <PublishedScheduleDialog
        log={log}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}

/** Always-visible list of published weeks (fixed-height panel, scrolls inside). */
export function ActivityFeed({
  refreshKey,
  className,
}: {
  refreshKey?: number;
  className?: string;
}) {
  const api = useApi();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api("/company/activity");
      if (!res.ok) return;
      const data = await res.json();
      if (data.activity) setLogs(data.activity);
    } catch {
      // Network/CORS/5xx — keep existing list (background refresh stays quiet).
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Live: other managers publishing show up without a reload.
  useVisiblePoll(true, fetchLogs);

  const prevKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevKeyRef.current) {
      prevKeyRef.current = refreshKey;
      fetchLogs();
    }
  }, [refreshKey, fetchLogs]);

  const toggle = () => setOpen((o) => !o);

  return (
    <Panel className={className}>
      {/* Accordion header — collapsed by default so long histories don't crowd the page */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className="cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <PanelHeader
          title="Activity"
          className={open ? undefined : "border-b-0"}
          meta={
            logs.length
              ? `${logs.length} published · latest ${timeAgo(logs[0]!.created_at)}`
              : loading
                ? undefined
                : "Nothing published yet"
          }
          actions={
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          }
        />
      </div>

      {open && (
        <div id={panelId}>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <PanelEmpty icon={<Send />} title="Nothing published yet">
              Publish a week from the schedule above and it will show up here.
            </PanelEmpty>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log, i) => (
                <PublishEntry key={log.id} log={log} isLatest={i === 0} />
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
