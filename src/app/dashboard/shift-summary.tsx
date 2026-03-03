"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

/** Returns YYYY-MM-DD in the client's local timezone */
function toLocalDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(dateStr));
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function ShiftSummary({
  initialShifts,
  employeeId,
}: {
  initialShifts: Shift[] | null;
  employeeId: string;
}) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts ?? []);

  // Re-fetch shifts directly from Supabase (client-side)
  const fetchShifts = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("shifts")
      .select("id, title, start_time, end_time")
      .eq("employee_id", employeeId)
      .order("start_time", { ascending: true });
    if (data) setShifts(data);
  };

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to any change on the shifts table — re-fetch on every event
    const channel = supabase
      .channel("employee-shifts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => {
          fetchShifts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const todayShift = shifts?.find((s) => toLocalDate(s.start_time) === localToday) ?? null;

  const getStatus = (s: Shift) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    if (now < start) return "upcoming";
    if (now > end) return "completed";
    return "ongoing";
  };

  const statusConfig = {
    completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
    ongoing:   { label: "Ongoing",   className: "bg-emerald-500/15 text-emerald-500" },
    upcoming:  { label: "Upcoming",  className: "bg-blue-500/15 text-blue-400" },
  };

  // Upcoming shifts this week (future days, not today)
  const endOfWeek = new Date(now);
  const daysToSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
  endOfWeek.setDate(now.getDate() + daysToSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  const thisWeekUpcoming = shifts.filter((s) => {
    const shiftDate = toLocalDate(s.start_time);
    return shiftDate > localToday && new Date(s.start_time) <= endOfWeek;
  });

  return (
    <>
      {/* Today's Shift */}
      {todayShift ? (() => {
        const status = getStatus(todayShift);
        const cfg = statusConfig[status];
        return (
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 sm:p-8 overflow-hidden">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">Today&apos;s Shift: {todayShift.title}</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.className}`}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{formatDate(todayShift.start_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{formatTime(todayShift.start_time)} – {formatTime(todayShift.end_time)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })() : (
        <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">No Shift Today</h2>
            <p className="text-muted-foreground">You don&apos;t have a shift scheduled for today. Enjoy your day off!</p>
          </div>
        </div>
      )}

      {/* Upcoming shifts this week — always shown */}
      <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold">Upcoming This Week</h2>
          {thisWeekUpcoming.length > 0 && (
            <span className="ml-auto text-xs font-medium bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
              {thisWeekUpcoming.length} shift{thisWeekUpcoming.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {thisWeekUpcoming.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 text-center text-muted-foreground text-sm">
            No more shifts scheduled for this week.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {thisWeekUpcoming.map((shift) => (
              <div key={shift.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{shift.title}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(shift.start_time)}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</span>
                  <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Upcoming</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
