import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/user-nav";
import { ProfileForm } from "./profile-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
      {/* Top Header / Welcome */}
      <header className="border-b border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link 
                href={profile.role === "employee" ? "/dashboard" : "/company/dashboard"}
                className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Your Profile
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserNav user={profile} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <ProfileForm user={profile} />
      </main>
    </div>
  );
}
