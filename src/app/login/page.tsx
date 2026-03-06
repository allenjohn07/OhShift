"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, User, Info, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Login failed", {
          description: data.error || "Invalid credentials.",
        });
        return;
      }

      toast.success("Welcome back!", {
        description: "Redirecting to your dashboard...",
      });
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Email required", { description: "Please enter your email to reset your password." });
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset email");
      toast.success("Reset email sent!", { description: "Check your inbox for the password reset link." });
    } catch (err: any) {
      toast.error("Reset failed", { description: err.message || "Could not send reset email. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 z-10 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-1.5 animate-fade-in"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>

      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] bg-accent/30 items-center justify-center p-12 border-r border-border/30 animate-fade-in">
        <div className="max-w-md space-y-8 animate-fade-in delay-100">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent">
            <User className="h-8 w-8 text-foreground/60" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Employee Portal
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              View your schedule, check upcoming shifts, and stay connected with
              your team — all from one place.
            </p>
          </div>
          <div className="space-y-4">
            {[
              "View your upcoming shifts at a glance",
              "Get notified about schedule changes",
              "Access from any device, anywhere",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-foreground/5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                </div>
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="text-center space-y-3 animate-fade-in">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-foreground text-background font-bold text-sm overflow-hidden">
                <span className="relative z-10">O</span>
                <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent" />
              </div>
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

          {/* Info box */}
          <div className="animate-fade-in delay-100 flex items-start gap-3 rounded-xl bg-accent/50 border border-border/50 p-4">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account is created when your company sends you a magic link.
              If you haven&apos;t received one, contact your manager.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5 animate-fade-in delay-200">
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
  );
}
