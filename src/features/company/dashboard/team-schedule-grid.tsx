import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Trash2, Loader2, Edit2, Send } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { AskOhShiftModal } from "./ask-ohshift-modal";
import type { CompanySettings } from "./company-settings";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShiftProperties } from "@/features/dashboard/shift-properties";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status?: "draft" | "published";
  users?: { full_name: string };
}

export function TeamScheduleGrid({
  shifts,
  company,
  onScheduleChanged,
}: {
  shifts: Shift[] | null;
  company?: CompanySettings | null;
  onScheduleChanged?: () => void | Promise<void>;
}) {
  const api = useApi();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const doneButtonRef = useRef<HTMLButtonElement>(null);

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
      try { navigator.vibrate(50); } catch {
        // Ignore vibration errors
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);

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

    if (hasChangedWeekInCurrentSwipe.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const isAtRightEdge = scrollLeft + clientWidth >= scrollWidth - 5;
    const isAtLeftEdge = scrollLeft <= 5;

    // If scrolling horizontally
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (isAtRightEdge && e.deltaX > 0) {
        overscrollAccumulator.current += e.deltaX;
        if (overscrollAccumulator.current > 80) {
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
        if (!isAtRightEdge && !isAtLeftEdge) {
          overscrollAccumulator.current = 0;
        }
      }
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedShift) return;
    setIsDeleting(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api(`/shifts?id=${selectedShift.id}&timezone=${encodeURIComponent(timezone)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete shift');
      
      toast.success("Shift deleted successfully");
      setSelectedShift(null);
      await onScheduleChanged?.();
    } catch {
      toast.error("Could not delete shift");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShift) return;
    setIsSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const date = formData.get("date") as string;
    const startTimeStr = formData.get("startTime") as string;
    const endTimeStr = formData.get("endTime") as string;

    const startTime = new Date(`${date}T${startTimeStr}`).toISOString();
    const endTime = new Date(`${date}T${endTimeStr}`).toISOString();

    try {
      const res = await api("/shifts", {
        method: "PUT",
        body: JSON.stringify({
          shiftId: selectedShift.id,
          title,
          startTime,
          endTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to edit shift");
      }

      toast.success("Shift updated successfully");
      setIsEditing(false);
      setSelectedShift(null);
      await onScheduleChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update shift");
    } finally {
      setIsSaving(false);
    }
  };

  // Formatting utilities
  const formatTime = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date(dateStr));
  };

  const formatDateLabel = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // Determine starting date
  const referenceDate = new Date();
  referenceDate.setHours(0, 0, 0, 0);

  const dayOfWeek = referenceDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const baseStartOfWeek = new Date(referenceDate);
  baseStartOfWeek.setDate(referenceDate.getDate() + diffToMonday);

  // Apply offset
  const startOfWeek = new Date(baseStartOfWeek);
  startOfWeek.setDate(baseStartOfWeek.getDate() + (weekOffset * 7));

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const headerDateRange = `${formatDateLabel(startOfWeek)} - ${formatDateLabel(endOfWeek)}, ${startOfWeek.getFullYear()}`;

  const weekStartIso = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;

  const weekShifts =
    shifts?.filter((s) => {
      const shiftDate = new Date(s.start_time);
      const weekEndExclusive = new Date(startOfWeek);
      weekEndExclusive.setDate(startOfWeek.getDate() + 7);
      return shiftDate >= startOfWeek && shiftDate < weekEndExclusive;
    }) ?? [];

  const draftCount = weekShifts.filter((s) => s.status === "draft").length;

  const handlePublishWeek = async () => {
    if (draftCount === 0) {
      toast.message("No draft shifts to publish for this week");
      return;
    }

    setIsPublishing(true);
    try {
      // Use the same local week bounds as the grid so drafts aren’t missed
      // when weekStart is interpreted as UTC-only on the server.
      const weekEndExclusive = new Date(startOfWeek);
      weekEndExclusive.setDate(startOfWeek.getDate() + 7);

      const res = await api("/company/schedule/publish", {
        method: "POST",
        body: JSON.stringify({
          weekStart: weekStartIso,
          from: startOfWeek.toISOString(),
          to: weekEndExclusive.toISOString(),
        }),
      });
      const data = await parseApiJson<{
        message?: string;
        publishedCount?: number;
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish schedule");
      }
      toast.success(data.message || "Schedule published");
      await onScheduleChanged?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Could not publish schedule",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 sm:px-5 py-2 min-h-12 flex flex-col sm:flex-row sm:items-center justify-between bg-card gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold">Schedule</h2>
            <AskOhShiftModal
              onCreated={onScheduleChanged}
              company={company}
            />
          </div>
          
          <div className="flex w-full items-center gap-1 sm:gap-2 self-start sm:self-auto sm:w-auto">
             <IconTooltip label="Previous week" side="bottom">
               <button 
                 onClick={() => setWeekOffset(prev => prev - 1)}
                 className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                 aria-label="Previous week"
               >
                 <ChevronLeft className="w-4 h-4" />
               </button>
             </IconTooltip>
             <span className="flex-1 min-w-0 text-xs font-medium text-center select-none whitespace-nowrap overflow-hidden sm:flex-none sm:w-40 sm:whitespace-normal sm:overflow-visible sm:text-sm">
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
             <button
               onClick={() => setWeekOffset(0)}
               className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
             >
               <span>Reset</span>
             </button>
             <button
               onClick={handlePublishWeek}
               disabled={isPublishing || draftCount === 0}
               className="ml-1 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium btn-brand disabled:cursor-not-allowed disabled:opacity-50"
             >
               {isPublishing ? (
                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
               ) : (
                 <Send className="w-3.5 h-3.5" />
               )}
               <span className="hidden sm:inline">Publish</span>
               {draftCount > 0 && (
                 <span className="sm:hidden">{draftCount}</span>
               )}
               {draftCount > 0 && (
                 <span className="hidden sm:inline">({draftCount})</span>
               )}
             </button>
          </div>
        </div>
        
        {/* Scroll hint wrapper — fades on the right edge to hint at scrollability on mobile */}
        <div className="relative w-full overflow-hidden">
          <div 
            ref={scrollRef}
            className="overflow-x-auto overscroll-x-none snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <div className="min-w-[560px] bg-card">
              <div className="grid grid-cols-7 gap-px bg-border/30">
                {[
                  ["Mon", "M"], ["Tue", "T"], ["Wed", "W"], ["Thu", "T"],
                  ["Fri", "F"], ["Sat", "S"], ["Sun", "S"]
                ].map(([full, short]) => (
                  <div key={full} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2.5 sm:py-3 bg-card snap-start">
                    <span className="hidden sm:inline">{full}</span>
                    <span className="sm:hidden">{short}</span>
                  </div>
                ))}
                
                {Array.from({ length: 7 }, (_, i) => {
                  const currentDay = new Date(startOfWeek);
                  currentDay.setDate(startOfWeek.getDate() + i);
                  
                  // Filter shifts that fall on this day
                  const dayShifts = (shifts?.filter(s => {
                    const shiftDate = new Date(s.start_time);
                    return shiftDate.getFullYear() === currentDay.getFullYear() &&
                           shiftDate.getMonth() === currentDay.getMonth() &&
                           shiftDate.getDate() === currentDay.getDate();
                  }) || []).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                  return (
                    <div key={i} className="bg-card p-1.5 sm:p-3 min-h-[100px] sm:min-h-[140px] space-y-1.5 relative snap-start">
                      <div className="absolute top-1 right-1.5 text-[9px] sm:text-[10px] text-muted-foreground/40 font-medium">
                        {currentDay.getDate()}
                      </div>
                        {dayShifts.map((shift) => (
                          <div 
                             key={shift.id} 
                             onClick={() => setSelectedShift(shift)}
                             className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-sm relative z-10 cursor-pointer border border-transparent transition-[filter] hover:brightness-95 dark:hover:brightness-125 ${getEmployeeColor(shift.users?.full_name)} ${shift.status === "draft" ? "border-dashed border-current/40 opacity-75" : ""}`}>
                            <span className="block truncate">{formatTime(shift.start_time).replace(':00', '').toLowerCase()} – {formatTime(shift.end_time).replace(':00', '').toLowerCase()}</span>
                            <span className="opacity-80 block truncate mt-0.5">
                              {shift.users?.full_name?.split(' ')[0]}: {shift.title}
                              {shift.status === "draft" && (
                                <span className="ml-1 text-[9px] uppercase tracking-wide opacity-70">· draft</span>
                              )}
                            </span>
                          </div>
                        ))}
                        {dayShifts.length === 0 && (
                          <div className="h-full flex items-center justify-center pt-4">
                            <span className="text-xs text-muted-foreground/30">-</span>
                          </div>
                        )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {/* Scroll hint gradient — only visible on small screens */}
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-8 bg-linear-to-l from-card/80 to-transparent sm:hidden" />
        </div>
      </div>

      {/* Shift details / edit */}
      <Dialog
        open={selectedShift !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving && !isDeleting) {
            setSelectedShift(null);
            setIsEditing(false);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => {
            // Never land on Delete — start on the safe primary action.
            e.preventDefault();
            doneButtonRef.current?.focus();
          }}
        >
          {selectedShift && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? "Edit shift" : selectedShift.title}
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? `${selectedShift.users?.full_name ?? "Team member"} · changes are checked for conflicts`
                    : "Shift details"}
                </DialogDescription>
              </DialogHeader>

              {isEditing ? (
                <form
                  id="edit-shift-form"
                  onSubmit={handleEditShift}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <DialogBody>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        name="title"
                        required
                        defaultValue={selectedShift.title}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        type="date"
                        id="date"
                        name="date"
                        required
                        defaultValue={new Date(selectedShift.start_time).toISOString().split("T")[0]}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="startTime">Start</Label>
                        <Input
                          type="time"
                          id="startTime"
                          name="startTime"
                          required
                          defaultValue={new Date(selectedShift.start_time).toTimeString().substring(0, 5)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">End</Label>
                        <Input
                          type="time"
                          id="endTime"
                          name="endTime"
                          required
                          defaultValue={new Date(selectedShift.end_time).toTimeString().substring(0, 5)}
                        />
                      </div>
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <>
                  <DialogBody>
                    <ShiftProperties
                      shift={selectedShift}
                      assignee={selectedShift.users?.full_name}
                    />
                  </DialogBody>
                  <DialogFooter className="sm:justify-between">
                    <Button
                      variant="ghost"
                      onClick={handleDeleteShift}
                      disabled={isDeleting}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {isDeleting ? "Deleting…" : "Delete"}
                    </Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button ref={doneButtonRef} onClick={() => setSelectedShift(null)}>
                        Done
                      </Button>
                    </div>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
