import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardContent } from "./dashboard-content";
import { RealtimeSubscriber } from "@/components/realtime-subscriber";
import type { CompanySettings } from "./manage-settings-modal";

export default async function DashboardPage() {
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

  // 4. Fetch Employees
  const { data: employees } = await supabase
    .from("users")
    .select("id, full_name, email, designation")
    .eq("company_id", profile.company_id)
    .eq("role", "employee")
    .order("full_name");

  // 5. Fetch all company shifts
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, users!shifts_employee_id_fkey(full_name)")
    .eq("company_id", profile.company_id)
    .order("start_time", { ascending: true });

  const formatTime = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date(dateStr));
  };


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col w-full overflow-x-hidden">
      <RealtimeSubscriber companyId={profile.company_id} />
      <DashboardContent 
        userName={profile.full_name?.split(' ')[0] || "Owner"}
        company={profile.companies as CompanySettings}
        employees={employees}
        shifts={shifts}
      />
    </div>
  );
}
