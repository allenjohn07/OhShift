"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Building2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match", {
        description: "Please make sure both passwords are the same.",
      });
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Registration failed", {
          description: data.error || "Something went wrong.",
        });
        return;
      }

      toast.success("Company registered!", {
        description: "You can now sign in with your credentials.",
      });
      router.push("/company/login");
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again later.",
      });
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

      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-accent/30 items-center justify-center p-12 border-r border-border/30 animate-fade-in">
        <div className="max-w-md space-y-8 animate-fade-in delay-100">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent">
            <Building2 className="h-8 w-8 text-foreground/60" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Start scheduling
              <br />
              <span className="text-muted-foreground">in minutes.</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Register your company and gain instant access to a powerful shift
              scheduling platform.
            </p>
          </div>
          <div className="space-y-4">
            {[
              "100% free forever",
              "No limits on team size",
              "Setup in under 2 minutes",
              "Invite unlimited managers",
              "Full access to all features",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-foreground/40 shrink-0" />
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
              Register your company
            </h1>
            <p className="text-sm text-muted-foreground">
              Create your workspace and start scheduling
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4 animate-fade-in delay-100">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-sm font-medium">
                Company name
              </Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Brew & Co."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Your full name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="alex@brewco.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
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
                  Creating account...
                </span>
              ) : (
                <>
                  Create company account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center space-y-3 animate-fade-in delay-200">
            <p className="text-xs text-muted-foreground/70">
              By registering, you agree to our Terms of Service and Privacy
              Policy.
            </p>
            <div className="h-px bg-border/50" />
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/company/login"
                className="text-foreground underline underline-offset-4 hover:text-foreground/80 font-medium transition-colors duration-300"
              >
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
