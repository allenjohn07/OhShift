"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { ProfileForm } from "./profile-form";
import { Footer } from "@/components/footer";
import type { AppRole } from "@/lib/nav";

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
  const api = useApi();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    let cancelled = false;

    api("/dashboard/profile")
      .then(async (res) => {
        const data = await parseApiJson<{ profile: ProfileData }>(res);
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok || !data.profile) return;
        setProfile(data.profile);
      })
      .catch(() => {
        // Transient API failures should not force login.
      });

    return () => {
      cancelled = true;
    };
  }, [api, router]);

  if (!profile) {
    return <PageSpinner />;
  }

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Your Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update how you appear to your team.
          </p>
        </div>
        <ProfileForm user={profile} />
      </main>
      <Footer className="mt-auto" />
    </>
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
