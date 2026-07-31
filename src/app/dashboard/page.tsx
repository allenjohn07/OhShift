"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { ShiftSummary } from "./shift-summary";
import { EmployeeScheduleGrid } from "./employee-schedule-grid";
import { TodayCompanySchedule } from "./today-company-schedule";
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
    let cancelled = false;

    api("/dashboard/employee")
      .then(async (res) => {
        const json = await parseApiJson<DashboardData & { error?: string }>(res);
        if (cancelled) return;

        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok || !json.profile) return;

        if (json.profile.role === "owner" || json.profile.role === "manager") {
          router.replace("/company/dashboard");
          return;
        }
        setData(json);
      })
      .catch(() => {
        // Transient API failures should not force login.
      });

    return () => {
      cancelled = true;
    };
  }, [api, router]);

  if (!data || !user) {
    return <PageSpinner />;
  }

  const profile = data.profile;
  const companyName = profile.companies?.name || "Your Company";

  return (
    <>
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 sm:space-y-8 flex-1">
        <div>
          <p className="text-sm font-medium text-brand mb-1">
            {companyName} Team
          </p>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {profile.full_name}
          </h1>
        </div>

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
    <AppShell role="employee">
      <AuthGuard allowedRoles={["employee"]}>
        <EmployeeDashboard />
      </AuthGuard>
    </AppShell>
  );
}
