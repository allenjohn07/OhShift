"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { ProfileForm } from "./profile-form";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

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
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    api("/dashboard/profile")
      .then((res) => parseApiJson<{ profile: ProfileData }>(res))
      .then((data) => setProfile(data.profile))
      .catch(() => router.replace("/login"));
  }, [api, router]);

  if (!profile) {
    return <PageSpinner />;
  }

  const role = profile.role || user?.profile.role;

  return (
    <>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center justify-start gap-4">
          <Link
            href={
              role === "employee" ? "/dashboard" : "/company/dashboard"
            }
            className="-ml-2 p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Your Profile
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <ProfileForm user={profile} />
      </main>
      <Footer className="mt-auto" />
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden flex flex-col">
      <Navbar />
      <AuthGuard>
        <ProfilePageContent />
      </AuthGuard>
    </div>
  );
}
