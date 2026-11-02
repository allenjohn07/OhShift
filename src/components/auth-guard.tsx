import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/components/auth-provider";
import { normalizePath } from "@/lib/nav";

/** Self-service pages managers/owners share with employees */
const SHARED_SELF_SERVICE = new Set([
  "/dashboard/availability",
  "/dashboard/time-off",
  "/dashboard/inbox",
  "/dashboard/hours",
]);

export function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  /** @deprecated Unused — unauthenticated users go to the landing page */
  loginPath?: string;
  allowedRoles?: Array<"owner" | "manager" | "employee">;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const path = normalizePath(pathname);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }

    const role = user.profile.role as "owner" | "manager" | "employee";

    if (allowedRoles && !allowedRoles.includes(role)) {
      if (role === "employee") navigate({ to: "/dashboard", replace: true });
      else navigate({ to: "/company/dashboard", replace: true });
      return;
    }

    const isSharedSelfService = SHARED_SELF_SERVICE.has(path);

    if (
      pathname.startsWith("/dashboard") &&
      role !== "employee" &&
      !isSharedSelfService
    ) {
      navigate({ to: "/company/dashboard", replace: true });
    }

    if (pathname.startsWith("/company/dashboard") && role === "employee") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, loading, navigate, allowedRoles, pathname, path]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (
    allowedRoles &&
    !allowedRoles.includes(user.profile.role as "owner" | "manager" | "employee")
  ) {
    return null;
  }

  return <>{children}</>;
}
