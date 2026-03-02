import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { LogoutButton } from "@/app/company/dashboard/logout-button";
import { RealtimeSubscriber } from "@/components/realtime-subscriber";

export default async function EmployeeDashboardPage() {
  const supabase = await createClient();

  // 1. Verify Authentication
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  // 2. Fetch Profile and Company
  const { data: profile } = await supabase
    .from("users")
    .select("*, companies(*)")
    .eq("id", authData.user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Color hashing by employee name to match the company dashboard
  const getEmployeeColor = (name: string = "") => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % 5;
    const colors = [
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
    ];
    return colors[colorIndex];
  };

  // 3. Authorization Check - Redirect owners/managers to company dashboard
  if (profile.role === "owner" || profile.role === "manager") {
    redirect("/company/dashboard");
  }

  const companyName = profile.companies?.name || "Your Company";
  const userName = profile.full_name;

  // 4. Fetch Shifts
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", authData.user.id)
    .order("start_time", { ascending: true })
    .gte("start_time", new Date().toISOString());

  const nextShift = shifts && shifts.length > 0 ? shifts[0] : null;
  const upcomingShifts = shifts && shifts.length > 1 ? shifts.slice(1) : [];

  const formatTime = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date(dateStr));
  };
  
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateStr));
  };

  return (
    <div className="min-h-screen bg-background">
      <RealtimeSubscriber companyId={profile.company_id} />
      {/* Top Header / Welcome */}
      <header className="border-b border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-500 mb-1">
                {companyName} Team
              </p>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {userName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        
        {/* Next Shift Callout */}
        {nextShift ? (
          <div className="rounded-2xl border border-border/50 bg-linear-to-br from-card to-accent/20 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            
            <div className="relative z-10 flex flex-col gap-2">
              <h2 className="text-lg font-semibold mb-2">Your Next Shift: {nextShift.title}</h2>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  <span>{formatDate(nextShift.start_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <span>{formatTime(nextShift.start_time)} - {formatTime(nextShift.end_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span>Main Location</span>
                </div>
              </div>
            </div>
            
            <div className="relative z-10">
              <button className="btn-hover h-10 px-6 rounded-xl font-medium bg-foreground text-background">
                Clock In
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center relative overflow-hidden">
             <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
                   <Calendar className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold">No Upcoming Shifts</h2>
                <p className="text-muted-foreground">You don't have any shifts scheduled currently. Enjoy your time off!</p>
             </div>
          </div>
        )}

        {/* Visual Weekly Schedule */}
        <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between bg-card">
             <div className="flex items-center gap-2">
               <Calendar className="h-5 w-5 text-emerald-500" />
               <h2 className="font-semibold text-lg">Your Schedule</h2>
             </div>
          </div>
          
          <div className="p-6 overflow-x-auto">
             <div className="min-w-[640px] rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 gap-px bg-border/30">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-3 bg-card">
                      {day}
                    </div>
                  ))}
                  
                  {Array.from({ length: 7 }, (_, i) => {
                    // Use the next shift's date to center the week around it, or fallback to today
                    const referenceDate = nextShift ? new Date(nextShift.start_time) : new Date();
                    // Reset time to start of day for accurate day comparisons
                    referenceDate.setHours(0, 0, 0, 0);
                    
                    const dayOfWeek = referenceDate.getDay();
                    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    
                    const startOfWeek = new Date(referenceDate);
                    startOfWeek.setDate(referenceDate.getDate() + diffToMonday);
                    
                    const currentDay = new Date(startOfWeek);
                    currentDay.setDate(startOfWeek.getDate() + i);
                    
                    // Filter shifts that fall on this day by comparing year, month, and date
                    const dayShifts = shifts?.filter(s => {
                      const shiftDate = new Date(s.start_time);
                      return shiftDate.getFullYear() === currentDay.getFullYear() &&
                             shiftDate.getMonth() === currentDay.getMonth() &&
                             shiftDate.getDate() === currentDay.getDate();
                    }) || [];

                    return (
                      <div key={i} className="bg-card p-3 min-h-[120px] space-y-2">
                         {dayShifts.map((shift, idx) => (
                           <div key={shift.id} className={`text-xs font-medium px-2.5 py-2 rounded-lg ${getEmployeeColor(profile?.full_name)}`}>
                              {formatTime(shift.start_time).replace(':00', '').toLowerCase()} – {formatTime(shift.end_time).replace(':00', '').toLowerCase()}
                              <br />
                              <span className="opacity-80 block truncate mt-0.5">
                                {shift.title}
                              </span>
                           </div>
                         ))}
                         {dayShifts.length === 0 && (
                            <div className="h-full flex items-center justify-center">
                              <span className="text-xs text-muted-foreground/50">-</span>
                            </div>
                         )}
                      </div>
                    )
                  })}
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
