"use client";

import { useCallback, useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Send,
  Clock,
  ChevronUp,
  ChevronRight,
  User,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { ScrollFade } from "@/components/scroll-fade";

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

function ShiftDetailModal({
  log,
  onClose,
}: {
  log: LogEntry;
  onClose: () => void;
}) {
  // Close on backdrop click or Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const weekLabel = formatWeek(log.week_start);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/40 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-soft text-brand shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-base leading-snug">{log.detail}</h2>
                {weekLabel && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Week of {weekLabel}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Published by{" "}
              <span className="font-medium text-foreground">{log.actor.full_name}</span>{" "}
              <span className="capitalize">({log.actor.role})</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(log.created_at)}
            </span>
          </div>
        </div>

        {/* Shifts list */}
        {log.shifts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No shift details available.
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-border/40">
            {log.shifts.map((shift) => (
              <div
                key={shift.id}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-brand-soft text-brand shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{shift.employee_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{shift.title}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0 text-right">
                  <p className="font-medium text-foreground/80">{formatDate(shift.start_time)}</p>
                  <p>{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {log.shifts.length} shift{log.shifts.length !== 1 ? "s" : ""} published
          </span>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PublishEntry({ log, isLatest }: { log: LogEntry; isLatest: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="border-b border-border/40 last:border-0">
        <button
          onClick={() => setModalOpen(true)}
          className="w-full px-4 sm:px-6 py-3 flex items-start gap-3 hover:bg-card/60 transition-colors text-left"
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

      {modalOpen && (
        <ShiftDetailModal log={log} onClose={() => setModalOpen(false)} />
      )}
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
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full border-b border-border/40 px-4 sm:px-6 py-4 bg-card flex items-center gap-2 hover:bg-card/80 transition-colors"
      >
        <Activity className="h-4 w-4 text-brand shrink-0" />
        <h2 className="font-semibold">Published Schedules</h2>
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
