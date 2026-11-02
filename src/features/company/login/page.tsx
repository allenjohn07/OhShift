import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { ColdStartBanner } from "@/components/cold-start-banner";
import { BrandMark } from "@/components/brand-mark";
import { IconTooltip } from "@/components/icon-tooltip";
import { rpc, unwrap } from "@/lib/rpc";

export default function CompanyLoginPage() {
  const navigate = useNavigate();
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
      navigate({ to: authUser.profile.role === "employee"
          ? "/dashboard"
          : "/company/dashboard" });
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
      const data = await unwrap(
        rpc.auth["reset-password"].$post(
          { json: { email } },
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
      setIsLoading(false);
    }
  };

  return (
    <>
      <ColdStartBanner />
      <div className="min-h-dvh bg-background flex flex-col relative">

        <div className="h-16 shrink-0 flex items-center">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-1.5 animate-fade-in"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-start sm:items-center justify-center px-6 pt-8 pb-12 sm:py-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-3 animate-fade-in">
              <Link to="/" className="inline-flex items-center gap-1.5 mb-4">
                <BrandMark size={22} />
                <span className="text-xl font-semibold tracking-tight">
                  OhShifts
                </span>
              </Link>
              <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
                Company Sign In
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to manage your team and schedules
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-5 animate-fade-in delay-100"
            >
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
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
                    className="h-9 pr-10"
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

              <Button
                type="submit"
                className="w-full h-9 font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

            <div className="text-center space-y-3 animate-fade-in delay-200">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have a company account?{" "}
                <Link
                  to="/company/register"
                  className="text-foreground underline underline-offset-4 hover:text-foreground/80 font-medium transition-colors duration-300"
                >
                  Register your company →
                </Link>
              </p>
              <div className="h-px bg-border" />
              <p className="text-sm text-muted-foreground">
                Looking for the employee login?{" "}
                <Link
                  to="/login"
                  className="text-foreground underline underline-offset-4 hover:text-foreground/80 font-medium transition-colors duration-300"
                >
                  Employee sign in →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
