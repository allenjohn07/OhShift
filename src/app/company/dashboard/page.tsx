import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Users, Calendar, Settings, Activity } from "lucide-react";
import { LogoutButton } from "@/app/company/dashboard/logout-button";
import { InviteEmployeeForm } from "./invite-form";

export default async function CompanyDashboardPage() {
  const supabase = await createClient();

  // 1. Verify Authentication
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/company/login");
  }

  // 2. Fetch Profile and Company
  const { data: profile } = await supabase
    .from("users")
    .select("*, companies(*)")
    .eq("id", authData.user.id)
    .single();

  if (!profile) {
    redirect("/company/login");
  }

  // 3. Authorization Check - Only allow company owners/managers
  if (profile.role === "employee") {
    // Redirect employees to the employee portal
    redirect("/login");
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
                {companyName} Workspace
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
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Team</p>
              <p className="text-2xl font-bold mt-1">12</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Shifts This Week</p>
              <p className="text-2xl font-bold mt-1">48</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Open Shifts</p>
              <p className="text-2xl font-bold mt-1">3</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Manage Setup</p>
              <p className="text-sm font-medium mt-1 text-foreground underline underline-offset-4 cursor-pointer">View Settings</p>
            </div>
          </div>
        </div>

        {/* Dashboard Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Schedule Preview Area (takes 2/3 width on large screens) */}
          <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden lg:col-span-2">
            <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between bg-card">
              <h2 className="font-semibold text-lg">Upcoming Shifts</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                View full schedule &rarr;
              </button>
            </div>
            <div className="p-12 text-center text-muted-foreground border-border/50 border-dashed border-2 m-6 rounded-xl bg-background/50">
              <p>Your team schedule will appear here.</p>
              <p className="text-sm mt-1">Start by inviting your employees to join {companyName}.</p>
            </div>
          </div>

          {/* Employee Invitation Form (takes 1/3 width on large screens) */}
          <div className="lg:col-span-1">
            <InviteEmployeeForm />
          </div>
        </div>
      </main>
    </div>
  );
}
