"use client";

import { useEffect, useState } from "react";
import { Users, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserInfo {
  full_name: string;
}

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  employee_id: string;
  users?: UserInfo;
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(dateStr));
}

function getEmployeeColor(name: string = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  ];
  return colors[Math.abs(hash) % 5];
}

/** Returns the Monday of the week containing the given date (UTC). */
function startOfWeekUtc(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(d);
  return `${fmt(monday)} – ${fmt(sunday)}, ${monday.getUTCFullYear()}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function TodayCompanySchedule({
  initialShifts,
  currentUserId,
}: {
  initialShifts: Shift[] | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const shifts = initialShifts ?? [];
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(interval);
  }, [router]);

  // Base week = current week's Monday (local timezone via toDateString comparison)
  const nowForWeek = new Date();
  const baseMonday = startOfWeekUtc(nowForWeek);

  const pageMonday = new Date(baseMonday);
  pageMonday.setUTCDate(baseMonday.getUTCDate() + weekOffset * 7);

  const pageSunday = new Date(pageMonday);
  pageSunday.setUTCDate(pageMonday.getUTCDate() + 7);

  const weekLabel = formatWeekLabel(pageMonday);

  // Filter shifts that fall within the displayed week
  const weekShifts = shifts
    .filter((s) => {
      const t = new Date(s.start_time).getTime();
      return t >= pageMonday.getTime() && t < pageSunday.getTime();
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Group by day label
  const grouped: Record<string, Shift[]> = {};
  const dayOrder: string[] = [];
  for (const shift of weekShifts) {
    const label = formatDayLabel(shift.start_time);
    if (!grouped[label]) {
      grouped[label] = [];
      dayOrder.push(label);
    }
    grouped[label].push(shift);
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-card">
        <div className="flex items-center gap-2 shrink-0">
          <Users className="h-5 w-5 text-emerald-500 shrink-0" />
          <h2 className="font-semibold text-lg whitespace-nowrap">Team Schedule</h2>
        </div>

        {/* Week pagination */}
        <div className="flex w-full items-center gap-1 sm:gap-2 bg-background/50 border border-border/50 rounded-xl p-1 self-start sm:self-auto sm:w-auto sm:ml-auto">
          <button
            onClick={() => setWeekOffset((p) => p - 1)}
            className="p-1.5 hover:bg-card rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="flex-1 min-w-0 text-xs font-medium text-center select-none whitespace-nowrap overflow-hidden sm:flex-none sm:w-48 sm:whitespace-normal sm:overflow-visible sm:text-sm">
            {weekLabel}
          </span>
          <button
            onClick={() => setWeekOffset((p) => p + 1)}
            className="p-1.5 hover:bg-card rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            title="Reset to current week"
            className="p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium bg-card hover:bg-card/80 border border-border/50 rounded-lg ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Body */}
      {weekShifts.length === 0 ? (
        <div className="px-4 sm:px-6 py-8 text-center text-muted-foreground text-sm">
          No shifts scheduled for this week.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/40">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Team Member</th>
                <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Shift / Role</th>
                <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Time</th>
              </tr>
            </thead>
            {dayOrder.map((dayLabel) => {
              const isToday = dayLabel === "Today";
              return (
                <tbody key={dayLabel} className="divide-y divide-border/40">
                  <tr>
                    <td
                      colSpan={3}
                      className={`px-4 sm:px-6 py-2.5 font-semibold text-xs border-y border-border/40 uppercase tracking-wider ${
                        isToday
                          ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/5"
                          : "text-muted-foreground bg-accent/30"
                      }`}
                    >
                      {dayLabel}
                    </td>
                  </tr>
                  {grouped[dayLabel].map((shift) => {
                    const isMe = shift.employee_id === currentUserId;
                    const employeeName = shift.users?.full_name || "Unknown Member";
                    return (
                      <tr key={shift.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getEmployeeColor(employeeName)}`}
                            >
                              {employeeName.charAt(0).toUpperCase()}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{employeeName}</span>
                              {isMe && (
                                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 font-medium text-foreground">
                          {shift.title}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}
