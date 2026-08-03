"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import { DashboardContent } from "./dashboard-content";
import type { CompanySettings } from "./manage-settings-modal";
import type { AppRole } from "@/lib/nav";

type CompanyDashboardData = {
  profile: {
    id: string;
    full_name: string;
    role: string;
    company_id: string;
    avatar_url?: string | null;
    companies: CompanySettings | null;
  };
  employees: Array<{
    id: string;
    full_name: string;
    email: string;
    designation: string | null;
    role?: "employee" | "manager";
  }>;
  shifts: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    employee_id: string;
    status?: "draft" | "published";
    users?: { full_name: string };
  }>;
  myShifts: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  }>;
};

function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
      <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function CompanyDashboard() {
  const api = useApi();
  const router = useRouter();
  const [data, setData] = useState<CompanyDashboardData | null>(null);

  const load = useCallback(async () => {
    const res = await api("/dashboard/company");
    const json = await parseApiJson<CompanyDashboardData & { error?: string }>(
      res,
    );

    if (res.status === 401) {
      router.replace("/company/login");
      return;
    }
    if (!res.ok || !json.profile) return;

    if (json.profile.role === "employee") {
      router.replace("/login");
      return;
    }
    setData(json);
  }, [api, router]);

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
