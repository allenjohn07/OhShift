import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import { ShiftSummary } from "./shift-summary";
import { EmployeeScheduleGrid } from "./employee-schedule-grid";
import { DayAgenda } from "./day-agenda";
import { greeting, todayLabel } from "@/lib/greeting";

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
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    const res = await api("/dashboard/employee");
    const json = await parseApiJson<DashboardData & { error?: string }>(res);

    if (res.status === 401) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!res.ok || !json.profile) return;

    if (json.profile.role === "owner" || json.profile.role === "manager") {
      navigate({ to: "/company/dashboard", replace: true });
      return;
    }
    setData(json);
  }, [api, navigate]);

  useVisiblePoll(true, load);

  if (!data || !user) {
    return <PageSpinner />;
  }

  const profile = data.profile;
  const companyName = profile.companies?.name || "Your company";

  return (
    <PageMain>
      <PageHeader
        eyebrow={`${companyName} · ${todayLabel()}`}
        title={greeting(profile.full_name ?? "")}
      />

      <ShiftSummary initialShifts={data.shifts} employeeId={user.id} />
      <EmployeeScheduleGrid
        initialShifts={data.shifts}
        employeeId={user.id}
        employeeName={profile.full_name ?? ""}
      />
      <DayAgenda shifts={data.companyShifts} currentUserId={user.id} />
    </PageMain>
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
