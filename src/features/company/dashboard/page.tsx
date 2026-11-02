import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { DashboardContent } from "./dashboard-content";
import type { CompanySettings } from "./company-settings";
import type { AppRole } from "@/lib/nav";
import { rpc, type ApiData } from "@/lib/rpc";

type CompanyDashboardData = ApiData<typeof rpc.dashboard.company.$get>;

function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
      <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function CompanyDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<CompanyDashboardData | null>(null);

  const load = useCallback(async () => {
    const res = await rpc.dashboard.company.$get();
    if (res.status === 401) {
      navigate({ to: "/company/login", replace: true });
      return;
    }
    const json = await res.json();
    if (!res.ok || "error" in json) return;

    if (json.profile.role === "employee") {
      navigate({ to: "/login", replace: true });
      return;
    }
    setData(json);
  }, [navigate]);

  const poll = useCallback(async () => {
    try {
      await load();
    } catch {
      // Quiet on background polls; initial failure keeps spinner until success.
    }
  }, [load]);

  useVisiblePoll(true, poll);

  if (!data) {
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
      onScheduleChanged={load}
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
