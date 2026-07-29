"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { DashboardContent } from "./dashboard-content";
import { RealtimeSubscriber } from "@/components/realtime-subscriber";
import type { CompanySettings } from "./manage-settings-modal";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

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

  useEffect(() => {
    api("/dashboard/company")
      .then((res) => parseApiJson<CompanyDashboardData & { error?: string }>(res))
      .then((json) => {
        if (json.profile?.role === "employee") {
          router.replace("/login");
          return;
        }
        setData(json);
      })
      .catch(() => router.replace("/company/login"));
  }, [api, router]);

  if (!data) {
    return <PageSpinner />;
  }

  return (
    <>
      <RealtimeSubscriber companyId={data.profile.company_id} />
      <DashboardContent
        userName={data.profile.full_name?.split(" ")[0] || "Owner"}
        company={data.profile.companies as CompanySettings}
        employees={data.employees}
        shifts={data.shifts}
        myShifts={data.myShifts ?? []}
        currentUser={data.profile}
      />
      <Footer className="mt-auto" />
    </>
  );
}

export default function CompanyDashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col w-full overflow-x-hidden">
      <Navbar />
      <AuthGuard
        loginPath="/company/login"
        allowedRoles={["owner", "manager"]}
      >
        <CompanyDashboard />
      </AuthGuard>
    </div>
  );
}
