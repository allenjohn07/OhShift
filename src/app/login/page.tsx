"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Info, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { ColdStartBanner } from "@/components/cold-start-banner";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const authUser = await login(email, password);
      toast.success("Welcome back!", {
        description: "Redirecting to your dashboard...",
      });
      router.push(
        authUser.profile.role === "employee"
          ? "/dashboard"
          : "/company/dashboard",
      );
    } catch (err: unknown) {
      toast.error("Login failed", {
        description:
          err instanceof Error ? err.message : "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Email required", {
        description: "Please enter your email to reset your password.",
      });
      return;
    }
    try {
      setIsLoading(true);
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        timeoutMs: 90_000,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
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
      setIsLoading(false);
    }
  };

  return (
    <>
      <ColdStartBanner />
      <div className="min-h-screen bg-background flex flex-col relative">
        <div className="fixed inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="h-16 shrink-0 flex items-center">
          <div className="w-full max-w-6xl mx-auto px-6 lg:px-12">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-1.5 animate-fade-in"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-6 pt-8 pb-12 sm:pt-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-3 animate-fade-in">
              <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
                <span className="text-xl font-semibold tracking-tight">
                  OhShift
                </span>
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight">
                Employee Sign In
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to view your schedule and shifts
              </p>
            </div>

            <div className="animate-fade-in delay-100 flex items-start gap-3 rounded-xl bg-accent/50 border border-border/50 p-4">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account is created when your company invites you. Use the
                invite email and code they share with you.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-5 animate-fade-in delay-200"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30 pr-10"
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

              <Button
                type="submit"
                className="btn-hover w-full h-11 rounded-xl font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="text-center space-y-3 animate-fade-in delay-300">
              <p className="text-xs text-muted-foreground/70">
                By signing in, you agree to our Terms of Service and Privacy
                Policy.
              </p>
              <div className="h-px bg-border/50" />
              <p className="text-sm text-muted-foreground">
                Managing a team?{" "}
                <Link
                  href="/company/login"
                  className="text-foreground underline underline-offset-4 hover:text-foreground/80 font-medium transition-colors duration-300"
                >
                  Company portal →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
