"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function AuthGuard({
  children,
  loginPath = "/login",
  allowedRoles,
}: {
  children: React.ReactNode;
  loginPath?: string;
  allowedRoles?: Array<"owner" | "manager" | "employee">;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(loginPath);
      return;
    }

    const role = user.profile.role as "owner" | "manager" | "employee";

    if (allowedRoles && !allowedRoles.includes(role)) {
      if (role === "employee") router.replace("/dashboard");
      else router.replace("/company/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard") && role !== "employee") {
      router.replace("/company/dashboard");
    }

    if (pathname.startsWith("/company/dashboard") && role === "employee") {
      router.replace("/login");
    }
  }, [user, loading, router, loginPath, allowedRoles, pathname]);

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
