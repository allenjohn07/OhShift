import { useState } from "react";
import { User, Building2, Calendar, Loader2, Eye, EyeOff } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Panel, PanelHeader } from "@/components/panel";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getEmployeeColor } from "@/lib/tag-colors";
import { rpc, unwrap } from "@/lib/rpc";

type ProfileUser = {
  full_name?: string | null;
  email: string;
  role: string;
  avatar_url?: string | null;
  created_at?: string;
  designation?: string | null;
  companies?: { name: string } | null;
};

export function ProfileForm({ user }: { user: ProfileUser }) {
  const { refreshUser } = useAuth();
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
      await unwrap(
        rpc.auth["update-avatar"].$post({ json: { avatarUrl } }),
        "Failed to update profile picture",
      );
      
      toast.success("Profile picture updated");
      await refreshUser();
      (e.target as HTMLFormElement).reset();
    } catch (error: unknown) {
      console.error("Avatar Update Error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile picture",
      );
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
      await unwrap(
        rpc.auth["change-password"].$post({ json: { currentPassword, newPassword } }),
        "Failed to update password",
      );

      toast.success("Password updated successfully");
      (e.target as HTMLFormElement).reset();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update password",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setIsSendingReset(true);
      const data = await unwrap(
        rpc.auth["reset-password"].$post(
          { json: { email: user.email } },
          // The API can be cold-starting; give it time.
          { init: { signal: AbortSignal.timeout(90_000) } },
        ),
        "Failed to reset password",
      );
      toast.success("Temporary password ready", {
        description: data.tempPassword
          ? `Copy this password and log in: ${data.tempPassword}`
          : data.message || "Use the temporary password to log in.",
        duration: 20_000,
      });
    } catch (err: unknown) {
      toast.error("Reset failed", {
        description:
          err instanceof Error
            ? err.message
            : "Could not reset password. Please try again.",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Who you are */}
      <Panel className="lg:col-span-2">
        <PanelHeader title="Profile" />
        <div className="flex flex-col items-center px-4 pt-6 pb-5 text-center sm:px-5">
          <Avatar className="mb-3 h-20 w-20">
            <AvatarImage src={user.avatar_url || ""} alt={user.full_name || "User"} />
            <AvatarFallback
              className={cn("text-xl font-semibold", getEmployeeColor(user.full_name || "User"))}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <p className="text-lg font-semibold">{user.full_name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <span className="mt-2 rounded-sm bg-brand-soft px-1.5 py-0.5 text-xs font-medium capitalize text-brand">
            {user.role}
          </span>
        </div>
        <dl className="mt-auto grid grid-cols-[7rem_1fr] gap-x-3 gap-y-3 border-t border-border px-4 py-4 text-sm sm:px-5">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Company
          </dt>
          <dd className="truncate">{companyName}</dd>
          {user.role !== "owner" && (
            <>
              <dt className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                Designation
              </dt>
              <dd className="truncate">{user.designation || "Not set"}</dd>
            </>
          )}
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Joined
          </dt>
          <dd>
            {user.created_at
              ? new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </dd>
        </dl>
      </Panel>

      {/* Settings */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <Panel>
          <PanelHeader title="Profile picture" />
          <form onSubmit={handleUpdateAvatar} className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
            <div className="space-y-2">
              <label htmlFor="avatarUrl" className="text-[13px] font-medium text-muted-foreground">
                Image URL
              </label>
              <input
                type="url"
                id="avatarUrl"
                name="avatarUrl"
                placeholder="https://example.com/avatar.jpg"
                defaultValue={user.avatar_url || ""}
                required
                className={cn(fieldClass, "h-9")}
              />
              <p className="text-xs text-muted-foreground">
                Provide a valid image URL for your profile picture.
              </p>
            </div>
            <div className="mt-auto flex justify-end">
              <Button
                type="submit"
                disabled={isUpdatingAvatar}

              >
                {isUpdatingAvatar && <Loader2 className="h-4 w-4 animate-spin" />}
                Save picture
              </Button>
            </div>
          </form>
        </Panel>

        <Panel className="flex-1">
          <PanelHeader title="Password" />
          <form onSubmit={handleUpdatePassword} className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="currentPassword" className="text-[13px] font-medium text-muted-foreground">
                  Current password
                </label>
                <IconTooltip label="Reset password" side="top">
                  <button 
                    type="button" 
                    onClick={handleResetPassword}
                    disabled={isSendingReset}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {isSendingReset ? "Sending..." : "Forgot password?"}
                  </button>
                </IconTooltip>
              </div>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                placeholder="••••••••"
                required
                className={cn(fieldClass, "h-9")}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-[13px] font-medium text-muted-foreground">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={cn(fieldClass, "h-9 pr-10")}
                />
                <IconTooltip
                  label={showPassword ? "Hide password" : "Show password"}
                  side="top"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </IconTooltip>
              </div>
            </div>
            <div className="mt-auto flex justify-end">
              <Button
                type="submit"
                disabled={isUpdatingPassword}

              >
                {isUpdatingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
