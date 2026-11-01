import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Moon, Sun, User } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ColdStartBanner } from "@/components/cold-start-banner";
import { BrandMark } from "@/components/brand-mark";
import { IconTooltip } from "@/components/icon-tooltip";
import { scrollToSection } from "@/lib/scroll-to-section";
import { cn } from "@/lib/utils";

const MENU_CLOSE_MS = 200;

/** In-page sections on the landing page — scrolled to without changing the URL. */
const SECTION_LINKS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "roles", label: "For teams" },
];

function subscribe() {
  return () => {};
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return <div className="h-8 w-8" />;
  const label =
    resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <IconTooltip label={label} side="bottom">
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        aria-label={label}
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </IconTooltip>
  );
}

/** Marketing navbar — for logged-out visitors only (landing / auth). */
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const menuShown = isOpen || isClosing;

  const closeMenu = () => {
    if (!isOpen || isClosing) return;
    setIsOpen(false);
    setIsClosing(true);
  };

  const toggleMenu = () => {
    if (isOpen) closeMenu();
    else {
      setIsClosing(false);
      setIsOpen(true);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
        setIsClosing(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isClosing) return;
    const id = window.setTimeout(() => setIsClosing(false), MENU_CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [isClosing]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuShown ? "hidden" : prev || "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuShown]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 w-full border-b border-transparent bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <BrandMark size={22} />
              <span className="text-[15px] font-semibold tracking-tight">
                OhShift
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-0.5">
              {SECTION_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={`/#${link.id}`}
                  onClick={(e) => scrollToSection(e, link.id)}
                  className="rounded-md px-2.5 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-md px-2.5 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            >
              Employee login
            </Link>
            <Link
              to="/company/login"
              className="rounded-md px-2.5 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            >
              Company login
            </Link>
            <Link to="/company/register" className="ml-1">
              <Button size="sm">Register your company</Button>
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <IconTooltip
              label={menuShown ? "Close menu" : "Open menu"}
              side="bottom"
            >
              <button
                type="button"
                onClick={toggleMenu}
                className="relative z-60 flex h-8 w-8 flex-col items-center justify-center gap-[5px] rounded-md transition-colors hover:bg-accent cursor-pointer"
                aria-label={menuShown ? "Close menu" : "Open menu"}
                aria-expanded={isOpen}
              >
                <span
                  className="block h-[1.5px] w-4 origin-center rounded-full bg-foreground"
                  style={{
                    transform: menuShown
                      ? "translateY(6.5px) rotate(45deg)"
                      : "none",
                  }}
                />
                <span
                  className="block h-[1.5px] w-4 rounded-full bg-foreground"
                  style={{ opacity: menuShown ? 0 : 1 }}
                />
                <span
                  className="block h-[1.5px] w-4 origin-center rounded-full bg-foreground"
                  style={{
                    transform: menuShown
                      ? "translateY(-6.5px) rotate(-45deg)"
                      : "none",
                  }}
                />
              </button>
            </IconTooltip>
          </div>
        </div>
      </nav>

      {/* Mobile menu — opens instantly; fades out on close */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-background",
          menuShown ? "pointer-events-auto" : "pointer-events-none opacity-0",
          isClosing &&
            "transition-opacity duration-200 motion-reduce:transition-none",
          isOpen && !isClosing && "opacity-100",
          isClosing && "opacity-0",
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col px-4 pt-20 pb-10">
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-col">
              {SECTION_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={`/#${link.id}`}
                  onClick={(e) => {
                    scrollToSection(e, link.id);
                    closeMenu();
                  }}
                  className="border-b border-border px-2 py-3 text-base font-medium"
                >
                  {link.label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={closeMenu}
                className="flex items-center gap-3 border-b border-border px-2 py-3"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-base font-medium">Employee login</span>
              </Link>
              <Link
                to="/company/login"
                onClick={closeMenu}
                className="flex items-center gap-3 border-b border-border px-2 py-3"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-base font-medium">Company login</span>
              </Link>
            </div>
            <Link to="/company/register" onClick={closeMenu}>
              <Button size="lg" className="w-full h-11 text-base">
                Register your company
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="h-14 w-full shrink-0" />
      <ColdStartBanner />
    </>
  );
}
