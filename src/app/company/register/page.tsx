"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { ColdStartBanner } from "@/components/cold-start-banner";

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

    try {
      const res = await apiFetch("/auth/register-company", {
        method: "POST",
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
    <>
      <ColdStartBanner />
      <div className="min-h-dvh bg-background flex flex-col relative">
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
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-1.5 animate-fade-in"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center px-6 pt-8 pb-12 lg:py-8">
          <div className="w-full max-w-sm lg:max-w-3xl space-y-6 lg:space-y-8">
            <div className="text-center space-y-3 animate-fade-in">
              <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
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

            <form
              onSubmit={handleRegister}
              className="space-y-4 animate-fade-in delay-100"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div className="space-y-4">
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
                    <Label htmlFor="firstName" className="text-sm font-medium">
                      First name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Alex"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium">
                      Last name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Morgan"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
                    />
                  </div>
                </div>

                <div className="space-y-4">
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
                    <Label
                      htmlFor="confirmPassword"
                      className="text-sm font-medium"
                    >
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
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
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
                </div>
              </div>

              <Button
                type="submit"
                className="btn-hover w-full h-11 rounded-xl font-medium lg:mt-2"
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
    </>
  );
}
