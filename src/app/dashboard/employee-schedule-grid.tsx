"use client";

import { useEffect, useState, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, X } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { toast } from "sonner";

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
  const [weekOffset, setWeekOffset] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const overscrollAccumulator = useRef(0);
  const lastWheelEventTime = useRef(0);
  const hasChangedWeekInCurrentSwipe = useRef(false);
  const lastSwipeDirection = useRef(0);

  const changeWeek = (direction: 1 | -1) => {
    setWeekOffset(prev => prev + direction);
    overscrollAccumulator.current = 0;
    
    // Attempt to play a subtle haptic feedback (supported on Android, ignored on iOS Safari)
    if (typeof window !== "undefined" && navigator && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch (e) {
        // Ignore vibration errors
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !scrollRef.current) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchEnd - touchStart;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const isAtRightEdge = scrollLeft + clientWidth >= scrollWidth - 5;
    const isAtLeftEdge = scrollLeft <= 5;

    // Swipe left (finger moves left, distance < 0) reveals right content
    if (distance < -50 && isAtRightEdge) {
      changeWeek(1); // Next week
    } 
    // Swipe right (finger moves right, distance > 0) reveals left content
    else if (distance > 50 && isAtLeftEdge) {
      changeWeek(-1); // Previous week
    }
    setTouchStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    const now = Date.now();
    
    // Determine the direction of the current scroll event
    const currentDirection = e.deltaX > 0 ? 1 : -1;

    // We consider it a "new swipe" if:
    // 1. User paused for a fraction of a second (150ms)
    // 2. The swipe direction reversed instantly (e.g. swiped left then right immediately)
    // 3. The velocity dropped near zero (which happens between consecutive quick swipes or at the end of inertia)
    if (
      now - lastWheelEventTime.current > 150 || 
      (lastSwipeDirection.current !== 0 && lastSwipeDirection.current !== currentDirection) ||
      Math.abs(e.deltaX) < 5
    ) {
      hasChangedWeekInCurrentSwipe.current = false;
      overscrollAccumulator.current = 0;
    }

    lastWheelEventTime.current = now;
    if (Math.abs(e.deltaX) >= 5) {
      lastSwipeDirection.current = currentDirection;
    }

    // If we already changed the week in this continuous swipe, ignore further events until they stop swiping
    if (hasChangedWeekInCurrentSwipe.current) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    
    const isAtRightEdge = scrollLeft + clientWidth >= scrollWidth - 5;
    const isAtLeftEdge = scrollLeft <= 5;

    // If scrolling horizontally
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (isAtRightEdge && e.deltaX > 0) {
        overscrollAccumulator.current += e.deltaX;
        if (overscrollAccumulator.current > 80) { // lowered threshold for slightly more responsiveness
          changeWeek(1);
          hasChangedWeekInCurrentSwipe.current = true;
        }
      } else if (isAtLeftEdge && e.deltaX < 0) {
        overscrollAccumulator.current += e.deltaX;
        if (overscrollAccumulator.current < -80) {
          changeWeek(-1);
          hasChangedWeekInCurrentSwipe.current = true;
        }
      } else {
        // Reset accumulator if scrolling away from edges
        if (!isAtRightEdge && !isAtLeftEdge) {
          overscrollAccumulator.current = 0;
        }
      }
    }
  };

  const api = useApi();

  const fetchShifts = async () => {
    const res = await api("/shifts/mine");
    if (!res.ok) return;
    const data = await res.json();
    if (data.shifts) setShifts(data.shifts);
  };

  useEffect(() => {
    const interval = setInterval(fetchShifts, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Build the requested week (Mon–Sun) based on offset
  const referenceDate = new Date();
  referenceDate.setHours(0, 0, 0, 0);

  const dayOfWeek = referenceDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const baseStartOfWeek = new Date(referenceDate);
  baseStartOfWeek.setDate(referenceDate.getDate() + diffToMonday);

  const startOfWeek = new Date(baseStartOfWeek);
  startOfWeek.setDate(baseStartOfWeek.getDate() + (weekOffset * 7));

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const headerDateRange = `${formatDateLabel(startOfWeek)} - ${formatDateLabel(endOfWeek)}, ${startOfWeek.getFullYear()}`;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between bg-card gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-500" />
          <h2 className="font-semibold text-lg">Your Schedule</h2>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-background/50 border border-border/50 rounded-xl p-1 self-start sm:self-auto">
           <button 
             onClick={() => setWeekOffset(prev => prev - 1)}
             className="p-1.5 hover:bg-card rounded-lg transition-colors text-muted-foreground hover:text-foreground"
             aria-label="Previous week"
           >
             <ChevronLeft className="w-4 h-4" />
           </button>
           <span className="text-xs sm:text-sm font-medium w-28 sm:w-40 text-center select-none">
             {headerDateRange}
           </span>
           <button 
             onClick={() => setWeekOffset(prev => prev + 1)}
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

      <div 
        ref={scrollRef}
        className="p-3 sm:p-6 overflow-x-auto overscroll-x-none snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
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
              }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

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
