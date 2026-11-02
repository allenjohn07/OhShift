import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { useAuth } from "@/components/auth-provider";
import { ShiftSummary } from "./shift-summary";
import { EmployeeScheduleGrid } from "./employee-schedule-grid";
import { DayAgenda } from "./day-agenda";
import { greeting, todayLabel } from "@/lib/greeting";
import { queries } from "@/lib/queries";
import { ApiRequestError } from "@/lib/rpc";

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
  const { data, error } = useQuery(queries.employeeDashboard());
  const unauthorized = error instanceof ApiRequestError && error.status === 401;
  const role = data?.profile.role;
  const isManager = role === "owner" || role === "manager";

  useEffect(() => {
    if (unauthorized) navigate({ to: "/login", replace: true });
    else if (isManager) navigate({ to: "/company/dashboard", replace: true });
  }, [unauthorized, isManager, navigate]);

  if (!data || !user || isManager) {
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
