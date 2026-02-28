import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { LogoutButton } from "@/app/company/dashboard/logout-button";

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

  // 3. Authorization Check - Redirect owners/managers to company dashboard
  if (profile.role === "owner" || profile.role === "manager") {
    redirect("/company/dashboard");
  }

  const companyName = profile.companies?.name || "Your Company";
  const userName = profile.full_name;

  return (
    <div className="min-h-screen bg-background">
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
        <div className="rounded-2xl border border-border/50 bg-linear-to-br from-card to-accent/20 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          
          <div className="relative z-10 flex flex-col gap-2">
            <h2 className="text-lg font-semibold mb-2">Your Next Shift</h2>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                <span>Tomorrow</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                <span>9:00 AM - 5:00 PM</span>
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

        {/* Schedule Preview Area */}
        <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between bg-card">
            <h2 className="font-semibold text-lg">Upcoming Shifts</h2>
            <button className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors font-medium">
              View full schedule &rarr;
            </button>
          </div>
          <div className="p-12 text-center text-muted-foreground border-border/50 border-dashed border-2 m-6 rounded-xl bg-background/50">
            <p>You have no other shifts scheduled for this week.</p>
            <p className="text-sm mt-1">Check back later or contact your manager if you think this is a mistake.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
