"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, User, Building2, Sun, Moon, LogOut, LayoutDashboard } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

export function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // Fetch user state
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setIsLoadingAuth(false);
      })
      .catch(() => setIsLoadingAuth(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setIsOpen(false);
    router.push("/");
    router.refresh();
  };

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 lg:px-12 h-16">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-foreground text-background font-bold text-sm overflow-hidden transition-transform duration-300 group-hover:scale-105">
            <span className="relative z-10">O</span>
            <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent" />
          </div>
          <span className="text-lg font-semibold tracking-tight">OhShift</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          )}

          {!isLoadingAuth && (
            user ? (
              <>
                <Link href={user.profile?.role === "employee" ? "/dashboard" : "/company/dashboard"}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-5 rounded-full font-medium"
                  >
                    Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="btn-hover h-9 px-4 rounded-full font-medium text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-hover h-9 px-5 rounded-full font-medium"
                  >
                    Employee Login
                  </Button>
                </Link>
                <Link href="/company/login">
                  <Button
                    size="sm"
                    className="btn-hover h-9 px-5 rounded-full font-medium"
                  >
                    Company Portal
                  </Button>
                </Link>
              </>
            )
          )}
        </div>

        {/* Mobile right side */}
        <div className="flex sm:hidden items-center gap-1.5">
          {/* Theme toggle mobile */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          )}
          {/* Hamburger icon with animated bars */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex flex-col items-center justify-center w-9 h-9 rounded-xl hover:bg-accent transition-colors duration-200 gap-[5px]"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            <span
              className="block w-4 h-[1.5px] bg-foreground rounded-full transition-all duration-300 origin-center"
              style={{
                transform: isOpen
                  ? "translateY(6.5px) rotate(45deg)"
                  : "none",
              }}
            />
            <span
              className="block w-4 h-[1.5px] bg-foreground rounded-full transition-all duration-300"
              style={{
                opacity: isOpen ? 0 : 1,
                transform: isOpen ? "scaleX(0)" : "scaleX(1)",
              }}
            />
            <span
              className="block w-4 h-[1.5px] bg-foreground rounded-full transition-all duration-300 origin-center"
              style={{
                transform: isOpen
                  ? "translateY(-6.5px) rotate(-45deg)"
                  : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer with slide-down animation */}
      <div
        ref={menuRef}
        className="sm:hidden overflow-hidden transition-all duration-200 ease-out"
        style={{
          maxHeight: isOpen ? "320px" : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="border-t border-border/40 bg-background">
          <div className="flex flex-col p-4 gap-2">
            {!isLoadingAuth && (
              user ? (
                <>
                  <Link href={user.profile?.role === "employee" ? "/dashboard" : "/company/dashboard"} onClick={() => setIsOpen(false)}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent transition-colors duration-200">
                      <LayoutDashboard className="h-4.5 w-4.5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Dashboard</div>
                        <div className="text-xs text-muted-foreground">
                          Manage your schedule and team
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="h-px bg-border/50 my-1" />
                  <button onClick={handleLogout} className="w-full text-left">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent transition-colors duration-200 text-rose-500">
                      <LogOut className="h-4.5 w-4.5" />
                      <div className="text-sm font-medium">Logout</div>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent transition-colors duration-200">
                      <User className="h-4.5 w-4.5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Employee Login</div>
                        <div className="text-xs text-muted-foreground">
                          Sign in to view your schedule
                        </div>
                      </div>
                    </div>
                  </Link>
                  <Link href="/company/login" onClick={() => setIsOpen(false)}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent transition-colors duration-200">
                      <Building2 className="h-4.5 w-4.5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Company Portal</div>
                        <div className="text-xs text-muted-foreground">
                          Manage your team and schedules
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="h-px bg-border/50 my-1" />
                  <Link href="/company/register" onClick={() => setIsOpen(false)}>
                    <Button className="btn-hover w-full h-11 rounded-xl font-medium">
                      Register your company
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className={`sm:hidden fixed inset-0 top-16 bg-black/20 backdrop-blur-[2px] z-[-1] transition-opacity duration-200 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
      />
    </nav>
  );
}
