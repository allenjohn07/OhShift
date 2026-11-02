import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/queries";
import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import { getEmployeeColor } from "@/lib/tag-colors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShiftProperties } from "./shift-properties";
import { formatTimeShort, startOfWeek as firstDayOfWeek, weekdayLabels } from "@/lib/dates";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

const formatDateLabel = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
};

export function EmployeeScheduleGrid({
  initialShifts,
  employeeName,
}: {
  initialShifts: Shift[] | null;
  employeeId?: string;
  employeeName: string;
}) {
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
      } catch {
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

  // First day of the requested week (Monday or Sunday, per display prefs), then offset
  const startOfWeek = firstDayOfWeek();
  startOfWeek.setDate(startOfWeek.getDate() + weekOffset * 7);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const rangeEnd = new Date(startOfWeek); rangeEnd.setDate(rangeEnd.getDate() + 7);
  const weekQuery = useQuery(queries.myShifts(startOfWeek.toISOString(), rangeEnd.toISOString()));
  const shifts = weekQuery.data?.shifts ?? initialShifts ?? [];
  const headerDateRange = `${formatDateLabel(startOfWeek)} - ${formatDateLabel(endOfWeek)}, ${startOfWeek.getFullYear()}`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 sm:px-5 py-2 min-h-12 flex flex-col sm:flex-row sm:items-center justify-between bg-card gap-2">
        <h2 className="font-semibold">Your schedule</h2>

        <div className="flex items-center gap-1 sm:gap-2 self-start sm:self-auto">
           <IconTooltip label="Previous week" side="bottom">
             <button 
               onClick={() => setWeekOffset(prev => prev - 1)}
               className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
               aria-label="Previous week"
             >
               <ChevronLeft className="w-4 h-4" />
             </button>
           </IconTooltip>
           <span className="text-xs sm:text-sm font-medium w-28 sm:w-40 text-center select-none">
             {headerDateRange}
           </span>
           <IconTooltip label="Next week" side="bottom">
             <button 
               onClick={() => setWeekOffset(prev => prev + 1)}
               className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
               aria-label="Next week"
             >
               <ChevronRight className="w-4 h-4" />
             </button>
           </IconTooltip>
           <IconTooltip label="Reset to current week" side="bottom">
             <button 
               onClick={() => setWeekOffset(0)}
               className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
             >
               <span>Reset</span>
             </button>
           </IconTooltip>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-none snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div className="min-w-[560px] bg-card">
          <div className="grid grid-cols-7 gap-px bg-border/30">
            {weekdayLabels().map((full) => [full, full[0]]).map(([full, short]) => (
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
                      className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-sm cursor-pointer border border-transparent transition-[filter] hover:brightness-95 dark:hover:brightness-125 relative z-10 ${getEmployeeColor(employeeName)}`}
                    >
                      {formatTimeShort(shift.start_time)} – {formatTimeShort(shift.end_time)}
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

      {/* Shift details */}
      <Dialog
        open={selectedShift !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedShift(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedShift && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedShift.title}</DialogTitle>
                <DialogDescription>Shift details</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <ShiftProperties shift={selectedShift} assignee={employeeName} />
              </DialogBody>
              <DialogFooter>
                <Button onClick={() => setSelectedShift(null)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
