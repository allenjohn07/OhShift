"use client";

import { useState } from "react";
import { User, Building2, Calendar, Lock, Loader2, Link as LinkIcon, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ProfileForm({ user }: { user: any }) {
  const router = useRouter();
  const supabase = createClient();
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const companyName = user.companies?.name || "Not assigned";
  const initials = user.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)
    : "U";

  const handleUpdateAvatar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdatingAvatar(true);
    
    const formData = new FormData(e.currentTarget);
    const avatarUrl = formData.get("avatarUrl") as string;
    
    try {
      const res = await fetch("/api/auth/update-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to update profile picture");
      
      toast.success("Profile picture updated");
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      console.error("Avatar Update Error:", error);
      toast.error(error.message || "Failed to update profile picture");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdatingPassword(true);
    
    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    
    try {
      // 1. Verify current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Incorrect current password.");
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      
      if (updateError) throw updateError;
      
      toast.success("Password updated successfully");
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setIsSendingReset(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset email");
      toast.success("Reset email sent!", { description: "Check your inbox for the password reset link." });
    } catch (err: any) {
      toast.error("Reset failed", { description: err.message || "Could not send reset email. Please try again." });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left Column - Profile Summary */}
      <div className="md:col-span-1 space-y-6">
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 border-2 border-border/50 mb-4 shadow-xs">
            <AvatarImage src={user.avatar_url || ""} alt={user.full_name} />
            <AvatarFallback className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xl font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{user.full_name}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-4 py-1.5 px-3 bg-accent rounded-full text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {user.role}
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">About</h3>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Company</p>
              <p className="text-sm font-medium">{companyName}</p>
            </div>
          </div>
          
          {user.role !== "owner" && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg shrink-0">
                <User className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Designation</p>
                <p className="text-sm font-medium">{user.designation || "Not set"}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p className="text-sm font-medium">
                {new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric"
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Forms */}
      <div className="md:col-span-2 space-y-6">
        {/* Avatar Settings */}
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
              <LinkIcon className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold">Profile Picture</h3>
          </div>
          <form onSubmit={handleUpdateAvatar} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="avatarUrl" className="text-sm font-medium">
                Avatar Image URL
              </label>
              <input
                type="url"
                id="avatarUrl"
                name="avatarUrl"
                placeholder="https://example.com/avatar.jpg"
                defaultValue={user.avatar_url || ""}
                required
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-emerald-500"
              />
              <p className="text-xs text-muted-foreground">
                Provide a valid image URL for your profile picture.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdatingAvatar} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                {isUpdatingAvatar && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Security Settings */}
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-rose-500/10 rounded-lg shrink-0">
              <Lock className="w-5 h-5 text-rose-500" />
            </div>
            <h3 className="text-lg font-semibold">Security</h3>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="currentPassword" className="text-sm font-medium">
                  Current Password
                </label>
                <button 
                  type="button" 
                  onClick={handleResetPassword}
                  disabled={isSendingReset}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isSendingReset ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                placeholder="••••••••"
                required
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-rose-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-rose-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isUpdatingPassword} variant="destructive" className="rounded-xl">
                {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
