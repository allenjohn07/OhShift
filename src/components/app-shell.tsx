"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import {
  LogOut,
  Menu,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Sun,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { ColdStartBanner } from "@/components/cold-start-banner";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  type AppRole,
  homeHrefForRole,
  isNavActive,
  mobileTabsForRole,
  navItemsForRole,
} from "@/lib/nav";
import {
  usePendingTimeOffSnapshot,
  usePendingTimeOffSync,
} from "@/hooks/use-pending-time-off";
import {
  useInboxUnreadSnapshot,
  useInboxUnreadSync,
} from "@/hooks/use-inbox-unread";

const SIDEBAR_COLLAPSED_KEY = "ohshift-sidebar-collapsed";
const SIDEBAR_EXPANDED_W = "w-60";
const SIDEBAR_COLLAPSED_W = "w-[4.25rem]";
const SIDEBAR_EXPANDED_PL = "md:pl-60";
const SIDEBAR_COLLAPSED_PL = "md:pl-[4.25rem]";

function subscribe() {
  return () => {};
}

function useThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return {
    mounted,
    isDark,
    toggle: () => setTheme(isDark ? "light" : "dark"),
  };
}

function getSidebarCollapsedSnapshot() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function getSidebarCollapsedServerSnapshot() {
  return false;
}

function subscribeSidebarCollapsed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );

  const toggle = () => {
    try {
      const next = !getSidebarCollapsedSnapshot();
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  };

  return { collapsed, toggle };
}

const compactTabClass =
  "flex w-full flex-col items-center gap-1 px-2 py-2 text-[10px] font-medium rounded-xl transition-colors cursor-pointer";

function SidebarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  const hide = () => setPos(null);

  return (
    <div
      ref={ref}
      className="relative flex justify-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md border border-border/50 bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </span>,
          document.body,
        )}
    </div>
  );
}

function NavBadge({
  count,
  compact,
  rail,
}: {
  count: number;
  compact?: boolean;
  rail?: boolean;
}) {
  if (count <= 0) return null;
  const text = count > 9 ? "9+" : String(count);

  if (rail || compact) {
    return (
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-brand text-[9px] font-bold leading-none text-brand-foreground",
          rail
            ? "-right-1 -top-1 h-4 min-w-4 px-0.5"
            : "-right-2 -top-1.5 h-4 min-w-4 px-0.5",
        )}
      >
        {text}
      </span>
    );
  }

  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft px-1.5 text-[10px] font-bold text-brand">
      {text}
    </span>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  compact,
  flush,
  rail,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
  compact?: boolean;
  flush?: boolean;
  rail?: boolean;
  badge?: number;
}) {
  const count = badge ?? 0;
  const ariaLabel =
    rail || compact
      ? count > 0
        ? `${label}, ${count} pending`
        : label
      : undefined;

  const link = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center rounded-xl transition-colors cursor-pointer",
        compact
          ? compactTabClass
          : rail
            ? "justify-center p-2.5"
            : flush
              ? "gap-3 py-2.5 text-sm font-medium"
              : "gap-3 px-3 py-2.5 text-sm font-medium",
        active
          ? "bg-brand-soft text-brand"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
    >
      <span className="relative inline-flex shrink-0">
        <Icon className={cn(compact || rail ? "h-5 w-5" : "h-4 w-4")} />
        {(rail || compact) && (
          <NavBadge count={count} compact={compact} rail={rail} />
        )}
      </span>
      {!rail && (
        <>
          <span className={cn(!compact && "truncate", compact && "leading-none")}>
            {label}
          </span>
          {!compact && <NavBadge count={count} />}
        </>
      )}
    </Link>
  );

  if (rail) {
    return (
      <SidebarTooltip label={count > 0 ? `${label} (${count})` : label}>
        {link}
      </SidebarTooltip>
    );
  }

  return link;
}

function AccountPanel({
  displayName,
  email,
  avatarUrl,
  onLogout,
  onNavigate,
  flush,
  rail,
}: {
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  onNavigate?: () => void;
  flush?: boolean;
  rail?: boolean;
}) {
  const { mounted, isDark, toggle } = useThemeToggle();
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "U";

  const firstName = displayName.split(/\s+/)[0] || displayName;

  const avatarTrigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className={cn(
          "flex items-center rounded-xl text-left transition-colors hover:bg-accent cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          rail
            ? "justify-center p-1.5"
            : cn("h-9 min-w-0 flex-1 gap-2.5", flush ? "px-0" : "px-2"),
        )}
      >
        <Avatar className="h-7 w-7 border border-border/50 shrink-0">
          <AvatarImage src={avatarUrl || ""} alt={displayName} />
          <AvatarFallback className="bg-brand-soft text-brand font-medium text-[10px]">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!rail && (
          <div className="min-w-0 flex-1 leading-none">
            <p className="text-sm font-medium truncate">{firstName}</p>
          </div>
        )}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <div
      className={cn(
        "flex",
        rail ? "flex-col items-center gap-2" : "items-center gap-1.5",
      )}
    >
      <DropdownMenu modal={false}>
        {rail ? (
          <SidebarTooltip label={firstName}>{avatarTrigger}</SidebarTooltip>
        ) : (
          avatarTrigger
        )}
        <DropdownMenuContent
          className="z-[80] w-52"
          side="top"
          align={rail ? "center" : "start"}
          sideOffset={8}
        >
          {(displayName || email) && (
            <>
              <div className="px-2 py-1.5">
                {displayName && (
                  <p className="text-sm font-medium truncate">{displayName}</p>
                )}
                {email && (
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                )}
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <Link href="/profile" onClick={onNavigate}>
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
          </Link>
          {rail && (
            <DropdownMenuItem onClick={toggle} className="cursor-pointer">
              {mounted && isDark ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              {mounted && isDark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={onLogout}
            className="text-red-500 focus:text-red-500 cursor-pointer focus:bg-red-500/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {!rail && (
        <button
          type="button"
          onClick={toggle}
          className="flex shrink-0 items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50 transition-colors cursor-pointer"
          aria-label={
            mounted && isDark ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {mounted && isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: AppRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const isManagerShell = role === "manager" || role === "owner";
  usePendingTimeOffSync(isManagerShell);
  useInboxUnreadSync(Boolean(user?.profile.company_id));
  const { pendingCount } = usePendingTimeOffSnapshot();
  const { total: inboxUnread } = useInboxUnreadSnapshot();

  const items = navItemsForRole(role);
  const mobileTabs = mobileTabsForRole(role);
  const menuExtras = items.filter((item) => !item.mobileTab);
  const homeHref = homeHrefForRole(role);
  const badgeFor = (id: string) => {
    if (id === "mgr-requests" && pendingCount > 0) return pendingCount;
    if ((id === "emp-inbox" || id === "mgr-inbox") && inboxUnread > 0) {
      return inboxUnread;
    }
    return undefined;
  };
  const profileActive = isNavActive(pathname, "/profile");
  const menuActive =
    menuOpen ||
    profileActive ||
    menuExtras.some((item) => isNavActive(pathname, item.href));

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [menuOpen]);

  const handleLogout = () => {
    try {
      setMenuOpen(false);
      logout();
      toast.success("Logged out successfully");
      router.replace("/");
    } catch {
      toast.error("Failed to logout");
    }
  };

  const displayName = user?.profile.full_name || "User";
  const email = user?.email;
  const avatarUrl = user?.profile.avatar_url;

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden flex flex-col">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-border/40 bg-background transition-[width] duration-300 ease-in-out",
          collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W,
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/40",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <Link
            href={homeHref}
            className={cn(
              "inline-flex items-center gap-1.5 min-w-0",
              collapsed && "justify-center",
            )}
          >
            <BrandMark size={22} />
            {!collapsed && (
              <span className="text-lg font-semibold tracking-tight truncate">
                OhShift
              </span>
            )}
          </Link>
        </div>
        <nav
          className={cn(
            "flex-1 overflow-y-auto space-y-1",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {items.map((item) => (
            <NavLink
              key={item.id}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isNavActive(pathname, item.href)}
              rail={collapsed}
              badge={badgeFor(item.id)}
            />
          ))}
        </nav>
        <div
          className={cn(
            "border-t border-border/40 space-y-2",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {collapsed ? (
            <SidebarTooltip label="Expand sidebar">
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex items-center justify-center p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            </SidebarTooltip>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              Collapse
            </button>
          )}
          <AccountPanel
            displayName={displayName}
            email={email}
            avatarUrl={avatarUrl}
            onLogout={handleLogout}
            rail={collapsed}
          />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-16 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="flex h-full items-center px-4 sm:px-6">
          <Link href={homeHref} className="inline-flex items-center gap-1.5">
            <BrandMark size={22} />
            <span className="text-lg font-semibold tracking-tight">OhShift</span>
          </Link>
        </div>
      </header>

      {/* Mobile menu sheet */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-[60] transition-opacity duration-200",
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/50 cursor-pointer"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-t-2xl border border-border/40 bg-background shadow-xl transition-transform duration-200",
            menuOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center w-9 h-9 -mr-1.5 rounded-xl hover:bg-accent cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {menuExtras.length > 0 && (
              <nav className="space-y-1 pb-3 border-b border-border/40">
                {menuExtras.map((item) => (
                  <NavLink
                    key={item.id}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isNavActive(pathname, item.href)}
                    onClick={() => setMenuOpen(false)}
                    flush
                    badge={badgeFor(item.id)}
                  />
                ))}
              </nav>
            )}
            <AccountPanel
              displayName={displayName}
              email={email}
              avatarUrl={avatarUrl}
              onLogout={handleLogout}
              onNavigate={() => setMenuOpen(false)}
              flush
            />
          </div>
        </div>
      </div>

      <div className="h-16 w-full shrink-0 md:hidden" />
      <ColdStartBanner />

      <div
        className={cn(
          "flex-1 flex flex-col pb-20 md:pb-0 transition-[padding] duration-300 ease-in-out",
          collapsed ? SIDEBAR_COLLAPSED_PL : SIDEBAR_EXPANDED_PL,
        )}
      >
        {children}
      </div>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="flex gap-1 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {mobileTabs.map((item) => (
            <div key={item.id} className="flex-1 min-w-0">
              <NavLink
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isNavActive(pathname, item.href)}
                compact
                badge={badgeFor(item.id)}
              />
            </div>
          ))}
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={cn(
                compactTabClass,
                menuActive
                  ? "bg-brand-soft text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
              <span className="leading-none">Menu</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
