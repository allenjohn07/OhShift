import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/components/auth-provider";
import { homeHrefForRole, type AppRole } from "@/lib/nav";

/** Sends authenticated users to their dashboard instead of marketing pages. */
export function AuthHomeRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const role = user.profile.role as AppRole;
    navigate({ to: homeHrefForRole(role), replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null;

  return <>{children}</>;
}
