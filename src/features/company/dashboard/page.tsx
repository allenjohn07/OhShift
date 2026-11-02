import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { DashboardContent } from "./dashboard-content";
import type { CompanySettings } from "./company-settings";
import type { AppRole } from "@/lib/nav";
import { queries } from "@/lib/queries";
import { ApiRequestError } from "@/lib/rpc";

function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
      <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function CompanyDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, error } = useQuery(queries.companyDashboard());
  const unauthorized = error instanceof ApiRequestError && error.status === 401;
  const isEmployee = data?.profile.role === "employee";

  useEffect(() => {
    if (unauthorized) navigate({ to: "/company/login", replace: true });
    else if (isEmployee) navigate({ to: "/login", replace: true });
  }, [unauthorized, isEmployee, navigate]);

  /** After a same-tab change: refetch everything a schedule edit can affect. */
  const onScheduleChanged = async () => {
    await Promise.all(
      [["dashboard"], ["company", "activity"], ["shifts"]].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  };

  if (!data || isEmployee) {
    return <PageSpinner />;
  }

  return (
    <DashboardContent
      userName={data.profile.full_name?.split(" ")[0] || "Owner"}
      company={data.profile.companies as CompanySettings}
      employees={data.employees}
      shifts={data.shifts}
      myShifts={data.myShifts ?? []}
      currentUser={data.profile}
      onScheduleChanged={onScheduleChanged}
    />
  );
}

export default function CompanyDashboardPage() {
  const { user } = useAuth();
  const role: AppRole = user?.profile.role === "owner" ? "owner" : "manager";

  return (
    <AppShell role={role}>
      <AuthGuard
        loginPath="/company/login"
        allowedRoles={["owner", "manager"]}
      >
        <CompanyDashboard />
      </AuthGuard>
    </AppShell>
  );
}
