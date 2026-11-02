import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageMain } from "@/components/page";
import { useAuth } from "@/components/auth-provider";
import { ProfileForm } from "./profile-form";
import type { AppRole } from "@/lib/nav";
import { rpc } from "@/lib/rpc";

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
      <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function ProfilePageContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    let cancelled = false;

    rpc.dashboard.profile
      .$get()
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          navigate({ to: "/login", replace: true });
          return;
        }
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setProfile(data.profile);
      })
      .catch(() => {
        // Transient API failures should not force login.
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

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
