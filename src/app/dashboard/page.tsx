import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { UserNav } from "@/components/user-nav";
import { RealtimeSubscriber } from "@/components/realtime-subscriber";
import { ShiftSummary } from "./shift-summary";
import { EmployeeScheduleGrid } from "./employee-schedule-grid";

export default async function EmployeeDashboardPage() {
  const supabase = await createClient();

  // 1. Verify Authentication
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  // 2. Fetch Profile and Company
  const { data: dbProfile } = await supabase
    .from("users")
    .select("*, companies(*)")
    .eq("id", authData.user.id)
    .single();

  if (!dbProfile) {
    redirect("/login");
  }

  // Merge avatar_url from Supabase Auth metadata
  const profile = {
    ...dbProfile,
    avatar_url: authData.user.user_metadata?.avatar_url || null,
  };

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
    .order("start_time", { ascending: true });

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <RealtimeSubscriber companyId={profile.company_id} />
      {/* Top Header / Welcome */}
      <header className="border-b border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-500 mb-1">
                {companyName} Team
              </p>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
                Welcome back, {userName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <UserNav user={profile} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
        
        {/* Today's Shift + Upcoming This Week — self-managed realtime */}
        <ShiftSummary initialShifts={shifts} employeeId={authData.user.id} />

        {/* Weekly Schedule — self-managed realtime */}
        <EmployeeScheduleGrid
          initialShifts={shifts}
          employeeId={authData.user.id}
          employeeName={profile.full_name ?? ""}
        />
      </main>
    </div>
  );
}
