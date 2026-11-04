import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { useAuth } from "@/components/auth-provider";
import { ProfileForm } from "./profile-form";
import type { AppRole } from "@/lib/nav";
import { queries } from "@/lib/queries";
import { ApiRequestError } from "@/lib/rpc";
import { Spinner } from "@/components/ui/spinner";

type ProfileData = {
  full_name?: string | null;
  email: string;
  role: string;
  avatar_url?: string | null;
  created_at?: string;
  designation?: string | null;
  companies?: { name: string } | null;
};

function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
      <Spinner className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

function ProfilePageContent() {
  const navigate = useNavigate();
  const { data, error } = useQuery(queries.profile());
  const profile: ProfileData | null = data?.profile ?? null;
  const unauthorized = error instanceof ApiRequestError && error.status === 401;

  useEffect(() => {
    if (unauthorized) navigate({ to: "/login", replace: true });
  }, [unauthorized, navigate]);

  if (!profile) {
    return <PageSpinner />;
  }

  return (
    <PageMain>
      <PageHeader
        eyebrow={profile.companies?.name}
        title="Profile"
        description="Update how you appear to your team."
      />
      <ProfileForm user={profile} />
    </PageMain>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const role = (user?.profile.role ?? "employee") as AppRole;
  const shellRole: AppRole =
    role === "owner" || role === "manager" || role === "employee"
      ? role
      : "employee";

  return (
    <AppShell role={shellRole}>
      <AuthGuard>
        <ProfilePageContent />
      </AuthGuard>
    </AppShell>
  );
}
