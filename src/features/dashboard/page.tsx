import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { useAuth } from "@/components/auth-provider";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { ShiftSummary } from "./shift-summary";
import { EmployeeScheduleGrid } from "./employee-schedule-grid";
import { DayAgenda } from "./day-agenda";
import { greeting, todayLabel } from "@/lib/greeting";
import { rpc, type ApiData } from "@/lib/rpc";

type DashboardData = ApiData<typeof rpc.dashboard.employee.$get>;

function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
      <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    const res = await rpc.dashboard.employee.$get();
    if (res.status === 401) {
      navigate({ to: "/login", replace: true });
      return;
    }
    const json = await res.json();
    if (!res.ok || "error" in json) return;

    if (json.profile.role === "owner" || json.profile.role === "manager") {
      navigate({ to: "/company/dashboard", replace: true });
      return;
    }
    setData(json);
  }, [navigate]);

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
