"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { RealtimeSubscriber } from "@/components/realtime-subscriber";
import { ShiftSummary } from "./shift-summary";
import { EmployeeScheduleGrid } from "./employee-schedule-grid";
import { TodayCompanySchedule } from "./today-company-schedule";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

type DashboardData = {
  profile: {
    full_name: string;
    role: string;
    company_id: string;
    companies?: { name: string } | null;
  };
  shifts: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  }>;
  companyShifts: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    employee_id: string;
    users?: { full_name: string };
  }>;
};

function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
      <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api("/dashboard/employee")
      .then((res) => parseApiJson<DashboardData & { error?: string }>(res))
      .then((json) => {
        if (json.profile?.role === "owner" || json.profile?.role === "manager") {
          router.replace("/company/dashboard");
          return;
        }
        setData(json);
      })
      .catch(() => router.replace("/login"));
  }, [api, router]);

  if (!data || !user) {
    return <PageSpinner />;
  }

  const profile = data.profile;
  const companyName = profile.companies?.name || "Your Company";

  return (
    <>
      <RealtimeSubscriber companyId={profile.company_id} />
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-2">
        <div>
          <p className="text-sm font-medium text-emerald-500 mb-1">
            {companyName} Team
          </p>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {profile.full_name}
          </h1>
        </div>
      </div>

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8 flex-1">
        <ShiftSummary initialShifts={data.shifts} employeeId={user.id} />
        <EmployeeScheduleGrid
          initialShifts={data.shifts}
          employeeId={user.id}
          employeeName={profile.full_name ?? ""}
        />
        <TodayCompanySchedule
          initialShifts={data.companyShifts}
          currentUserId={user.id}
        />
      </main>
      <Footer className="mt-auto" />
    </>
  );
}

export default function EmployeeDashboardPage() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden flex flex-col">
      <Navbar />
      <AuthGuard allowedRoles={["employee"]}>
        <EmployeeDashboard />
      </AuthGuard>
    </div>
  );
}
