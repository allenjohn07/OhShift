"use client";

import { useEffect } from "react";
import { Users, Clock } from "lucide-react";
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

export function TodayCompanySchedule({
  initialShifts,
  companyId,
  currentUserId,
}: {
  initialShifts: Shift[] | null;
  companyId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const shifts = initialShifts ?? [];

  useEffect(() => {
    // Poll the server for fresh data to simulate real-time for the company schedule
    // since client-side Supabase subscriptions are blocked by RLS for other users' shifts
    const interval = setInterval(() => {
      router.refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  // Removed client-side fetching and realtime subscription here because 
  // the client-side Supabase client respects RLS, which prevents an employee
  // from fetching other employees' shifts. The server-side admin client in page.tsx 
  // provides the initial data correctly.

  // Display shifts from today onwards
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingShifts = shifts.filter((s) => new Date(s.start_time) >= now);

  // Sort upcoming shifts by start time
  upcomingShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  function formatDateLabel(dateStr: string) {
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

  // Group shifts by date label
  const groupedShifts = upcomingShifts.reduce((acc, shift) => {
    const dateLabel = formatDateLabel(shift.start_time);
    if (!acc[dateLabel]) acc[dateLabel] = [];
    acc[dateLabel].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  // Extract unique sorted date labels
  const sortedDateLabels = Array.from(new Set(upcomingShifts.map((s) => formatDateLabel(s.start_time))));



  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 flex items-center justify-between bg-card gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-500 shrink-0" />
          <h2 className="font-semibold text-lg whitespace-nowrap">Team Schedule</h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        {upcomingShifts.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 text-center text-muted-foreground text-sm">
            No upcoming shifts scheduled for the team.
          </div>
        ) : (
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/40">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Team Member</th>
                <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Shift / Role</th>
                <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Time</th>
              </tr>
            </thead>
            {sortedDateLabels.map((dateLabel) => {
              const isToday = dateLabel === "Today";
              return (
                <tbody key={dateLabel} className="divide-y divide-border/40">
                  <tr className="bg-muted/5">
                    <td colSpan={3} className={`px-4 sm:px-6 py-2.5 font-semibold text-xs border-y border-border/40 uppercase tracking-wider ${isToday ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/5" : "text-muted-foreground bg-accent/30"}`}>
                      {dateLabel}
                    </td>
                  </tr>
                  {groupedShifts[dateLabel].map((shift) => {
                    const isMe = shift.employee_id === currentUserId;
                    const employeeName = shift.users?.full_name || "Unknown Member";
                    
                    return (
                      <tr key={shift.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getEmployeeColor(
                                employeeName
                              )}`}
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
        )}
      </div>
    </div>
  );
}
