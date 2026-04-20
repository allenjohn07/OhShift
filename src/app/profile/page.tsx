import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { ProfileForm } from "./profile-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/navbar";

export default async function ProfilePage() {
  const supabase = await createClient();

  // 1. Verify Authentication
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  // 2. Fetch Profile and Company
  const { data: dbProfile } = await supabase
    .from("users")
    .select("*, companies(*)")
    .eq("id", authData.user.id)
    .single();

  if (!dbProfile) {
    redirect("/login");
  }

  // 3. Merge avatar_url from Supabase Auth metadata
  const profile = {
    ...dbProfile,
    avatar_url: authData.user.user_metadata?.avatar_url || null,
  };

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <Navbar />
      {/* Top Header / Welcome */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center gap-4">
          <Link 
            href={profile.role === "employee" ? "/dashboard" : "/company/dashboard"}
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <ProfileForm user={profile} />
      </main>
    </div>
  );
}
