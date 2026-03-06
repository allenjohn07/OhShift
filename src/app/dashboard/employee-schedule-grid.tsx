"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(dateStr));
}

const formatDateLabel = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
};

function getEmployeeColor(name: string = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ring-emerald-500/50",
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 ring-blue-500/50",
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 ring-violet-500/50",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ring-amber-500/50",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 ring-rose-500/50",
  ];
  return colors[Math.abs(hash) % 5];
}

export function EmployeeScheduleGrid({
  initialShifts,
  employeeId,
  employeeName,
}: {
  initialShifts: Shift[] | null;
  employeeId: string;
  employeeName: string;
}) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts ?? []);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

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
    const channel = supabase
      .channel("employee-schedule-grid-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => { fetchShifts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Build the current week (Mon–Sun)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 flex items-center gap-2 bg-card">
        <Calendar className="h-5 w-5 text-emerald-500" />
        <h2 className="font-semibold text-lg">Your Schedule</h2>
      </div>

      <div className="p-3 sm:p-6 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[560px] rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 gap-px bg-border/30">
            {[["Mon", "M"], ["Tue", "T"], ["Wed", "W"], ["Thu", "T"], ["Fri", "F"], ["Sat", "S"], ["Sun", "S"]].map(([full, short]) => (
              <div key={full} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2.5 sm:py-3 bg-card">
                <span className="hidden sm:inline">{full}</span>
                <span className="sm:hidden">{short}</span>
              </div>
            ))}

            {Array.from({ length: 7 }, (_, i) => {
              const currentDay = new Date(startOfWeek);
              currentDay.setDate(startOfWeek.getDate() + i);

              const dayShifts = shifts.filter((s) => {
                const d = new Date(s.start_time);
                return d.getFullYear() === currentDay.getFullYear() &&
                       d.getMonth() === currentDay.getMonth() &&
                       d.getDate() === currentDay.getDate();
              });

              return (
                <div key={i} className="bg-card p-1.5 sm:p-3 min-h-[100px] sm:min-h-[140px] space-y-1.5 relative snap-start">
                  <div className="absolute top-1 right-1.5 text-[9px] sm:text-[10px] text-muted-foreground/40 font-medium">
                    {currentDay.getDate()}
                  </div>
                  {dayShifts.map((shift) => (
                    <div 
                      key={shift.id} 
                      onClick={() => setSelectedShift(shift)}
                      className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-lg cursor-pointer hover:ring-2 ring-offset-1 ring-offset-card transition-all relative z-10 ${getEmployeeColor(employeeName)}`}
                    >
                      {formatTime(shift.start_time).replace(":00", "").toLowerCase()} – {formatTime(shift.end_time).replace(":00", "").toLowerCase()}
                      <br />
                      <span className="opacity-80 block truncate mt-0.5">{shift.title}</span>
                    </div>
                  ))}
                  {dayShifts.length === 0 && (
                    <div className="h-full flex items-center justify-center pt-4">
                      <span className="text-xs text-muted-foreground/50">-</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Shift Details Dialog */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border/50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden relative">
            <button 
              onClick={() => setSelectedShift(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
               <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                 <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                   <Calendar className="w-5 h-5" />
                 </div>
                 Shift Details
               </h3>
               
               <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                      <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Assigned to</p>
                      <p className="text-base font-medium">{employeeName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Time</p>
                      <p className="text-base font-medium text-blue-600 dark:text-blue-400">
                        {formatDateLabel(new Date(selectedShift.start_time))}
                      </p>
                      <p className="text-sm font-medium mt-0.5 opacity-90">
                        {formatTime(selectedShift.start_time)} <span className="text-muted-foreground font-normal mx-1">to</span> {formatTime(selectedShift.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-violet-500/10 rounded-lg shrink-0">
                      <MapPin className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Role / Title</p>
                      <p className="text-base font-medium">{selectedShift.title}</p>
                    </div>
                  </div>
               </div>
            </div>
            <div className="p-4 border-t border-border/50 bg-black/5 dark:bg-white/5 flex items-center justify-end gap-2">
               <button 
                 onClick={() => setSelectedShift(null)}
                 className="px-4 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 rounded-xl transition-colors"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
