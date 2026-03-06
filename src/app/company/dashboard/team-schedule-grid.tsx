"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, X, Trash2, Loader2, Edit2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  users?: { full_name: string };
}

export function TeamScheduleGrid({ shifts }: { shifts: Shift[] | null }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Color hashing by employee name
  const getEmployeeColor = (name: string = "") => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % 5;
    const colors = [
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ring-emerald-500/50",
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 ring-blue-500/50",
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 ring-violet-500/50",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ring-amber-500/50",
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 ring-rose-500/50"
    ];
    return colors[colorIndex];
  };

  const handleDeleteShift = async () => {
    if (!selectedShift) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/shifts?id=${selectedShift.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete shift');
      
      toast.success("Shift deleted successfully");
      setSelectedShift(null);
      router.refresh();
    } catch (error) {
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
      const res = await fetch("/api/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          title,
          startTime,
          endTime,
        }),
      });

      if (!res.ok) throw new Error("Failed to edit shift");

      toast.success("Shift updated successfully");
      setIsEditing(false);
      setSelectedShift(null);
      router.refresh();
    } catch (error) {
      toast.error("Could not update shift");
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

  return (
    <>
      <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden mt-8">
        <div className="border-b border-border/40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between bg-card gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold text-lg">Team Schedule</h2>
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
             {/* Reset: icon on mobile, label on sm+ */}
             <button 
               onClick={() => setWeekOffset(0)}
               title="Reset to current week"
               className="p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium bg-card hover:bg-card/80 border border-border/50 rounded-lg ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
             >
               <span className="hidden sm:inline">Reset</span>
               <span className="sm:hidden">↺</span>
             </button>
          </div>
        </div>
        
        {/* Scroll hint wrapper — fades on the right edge to hint at scrollability on mobile */}
        <div className="relative w-full overflow-hidden">
          <div className="p-3 sm:p-6 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="min-w-[560px] rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
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
                  const dayShifts = shifts?.filter(s => {
                    const shiftDate = new Date(s.start_time);
                    return shiftDate.getFullYear() === currentDay.getFullYear() &&
                           shiftDate.getMonth() === currentDay.getMonth() &&
                           shiftDate.getDate() === currentDay.getDate();
                  }) || [];

                  return (
                    <div key={i} className="bg-card p-1.5 sm:p-3 min-h-[100px] sm:min-h-[140px] space-y-1.5 relative snap-start">
                      <div className="absolute top-1 right-1.5 text-[9px] sm:text-[10px] text-muted-foreground/40 font-medium">
                        {currentDay.getDate()}
                      </div>
                        {dayShifts.map((shift) => (
                          <div 
                             key={shift.id} 
                             onClick={() => setSelectedShift(shift)}
                             className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-lg relative z-10 cursor-pointer hover:ring-2 ring-offset-1 ring-offset-card transition-all ${getEmployeeColor(shift.users?.full_name)}`}>
                            <span className="block truncate">{formatTime(shift.start_time).replace(':00', '').toLowerCase()} – {formatTime(shift.end_time).replace(':00', '').toLowerCase()}</span>
                            <span className="opacity-80 block truncate mt-0.5">
                              {shift.users?.full_name?.split(' ')[0]}: {shift.title}
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

      {/* Shift Details Dialog */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border/50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden relative">
            <button 
              onClick={() => {
                setSelectedShift(null);
                setIsEditing(false);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
               <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                 <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                   <Calendar className="w-5 h-5" />
                 </div>
                 {isEditing ? "Edit Shift" : "Shift Details"}
               </h3>
               
               {isEditing ? (
                 <form id="edit-shift-form" onSubmit={handleEditShift} className="space-y-4 text-left">
                   <div className="space-y-2">
                     <label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Role / Title
                     </label>
                     <input
                       type="text"
                       id="title"
                       name="title"
                       required
                       defaultValue={selectedShift.title}
                       className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                     />
                   </div>
                   <div className="space-y-2">
                     <label htmlFor="date" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Date
                     </label>
                     <input
                       type="date"
                       id="date"
                       name="date"
                       required
                       defaultValue={new Date(selectedShift.start_time).toISOString().split('T')[0]}
                       className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                     />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-2">
                       <label htmlFor="startTime" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                         Start Time
                       </label>
                       <input
                         type="time"
                         id="startTime"
                         name="startTime"
                         required
                         defaultValue={new Date(selectedShift.start_time).toTimeString().substring(0, 5)}
                         className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                       />
                     </div>
                     <div className="space-y-2">
                       <label htmlFor="endTime" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                         End Time
                       </label>
                       <input
                         type="time"
                         id="endTime"
                         name="endTime"
                         required
                         defaultValue={new Date(selectedShift.end_time).toTimeString().substring(0, 5)}
                         className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                       />
                     </div>
                   </div>
                 </form>
               ) : (
                 <div className="space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                        <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Assigned to</p>
                        <p className="text-base font-medium">{selectedShift.users?.full_name}</p>
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
               )}
            </div>
            <div className="p-4 border-t border-border/50 bg-black/5 dark:bg-white/5 flex items-center justify-between gap-2">
               {!isEditing ? (
                 <>
                   <button 
                      onClick={handleDeleteShift}
                      disabled={isDeleting}
                      className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors flex items-center gap-2"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      <span className="hidden sm:inline">{isDeleting ? "Deleting..." : "Delete"}</span>
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button 
                         onClick={() => setIsEditing(true)}
                         className="px-3 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors flex items-center gap-2"
                       >
                         <Edit2 className="w-4 h-4" />
                         Edit
                       </button>
                      <button 
                         onClick={() => setSelectedShift(null)}
                         className="px-4 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 rounded-xl transition-colors"
                       >
                         Close
                       </button>
                    </div>
                 </>
               ) : (
                 <>
                   <button 
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                   <button 
                      type="submit"
                      form="edit-shift-form"
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-2"
                    >
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                 </>
               )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
