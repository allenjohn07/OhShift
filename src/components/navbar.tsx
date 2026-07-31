"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, User, Building2, Sun, Moon } from "lucide-react";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ColdStartBanner } from "@/components/cold-start-banner";
import { BrandMark } from "@/components/brand-mark";

function subscribe() {
  return () => {};
}

/** Marketing navbar — for logged-out visitors only (landing / auth). */
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prev || "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 w-full z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link href="/" className="flex items-center gap-1.5 group">
            <BrandMark size={22} />
            <span className="text-lg font-semibold tracking-tight">OhShift</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2">
            {mounted ? (
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 border border-border/50 cursor-pointer"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-9 h-9" />
            )}

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
          </div>

          <div className="flex sm:hidden items-center gap-1.5">
            {mounted ? (
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 border border-border/50 cursor-pointer"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-9 h-9" />
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="relative z-60 flex flex-col items-center justify-center w-9 h-9 rounded-xl hover:bg-accent transition-colors duration-200 gap-[5px] cursor-pointer"
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
      </nav>

      <div
        ref={menuRef}
        className={`sm:hidden fixed inset-0 z-40 bg-background transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col px-6 pt-24 pb-10">
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-col gap-2">
              <Link href="/login" onClick={() => setIsOpen(false)}>
                <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/40 px-5 py-5 transition-colors duration-200 hover:bg-accent">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-base font-medium">Employee Login</div>
                    <div className="text-sm text-muted-foreground">
                      Sign in to view your schedule
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/company/login" onClick={() => setIsOpen(false)}>
                <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/40 px-5 py-5 transition-colors duration-200 hover:bg-accent">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-base font-medium">Company Portal</div>
                    <div className="text-sm text-muted-foreground">
                      Manage your team and schedules
                    </div>
                  </div>
                </div>
              </Link>
            </div>
            <Link href="/company/register" onClick={() => setIsOpen(false)}>
              <Button className="btn-hover w-full h-12 rounded-xl font-medium text-base">
                Register your company
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="h-16 w-full shrink-0" />
      <ColdStartBanner />
    </>
  );
}
