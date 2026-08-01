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
  shellRoleFromProfile,
} from "@/lib/nav";
import {
  usePendingTimeOffSnapshot,
  usePendingTimeOffSync,
} from "@/hooks/use-pending-time-off";
import {
  usePendingTimesheetsSnapshot,
  usePendingTimesheetsSync,
} from "@/hooks/use-pending-timesheets";
import {
  useInboxUnreadSnapshot,
  useInboxUnreadSync,
} from "@/hooks/use-inbox-unread";

const SIDEBAR_COLLAPSED_KEY = "ohshift-sidebar-collapsed";
/** Expanded / collapsed widths — icons sit on a fixed left gutter in both states */
const SIDEBAR_EXPANDED_W = "w-60";
const SIDEBAR_COLLAPSED_W = "w-16";
const SIDEBAR_EXPANDED_PL = "md:pl-60";
const SIDEBAR_COLLAPSED_PL = "md:pl-16";
/** No overshoot — previous curve felt like a bounce */
const SIDEBAR_EASE =
  "duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none";

/** Neon-style label fade: hide quickly on collapse, reveal after width opens */
function sidebarLabelClass(collapsed: boolean) {
  return cn(
    "min-w-0 truncate whitespace-nowrap transition-opacity motion-reduce:transition-none",
    collapsed
      ? "opacity-0 duration-150 pointer-events-none"
      : "opacity-100 duration-200 delay-100",
  );
}

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
  enabled = true,
}: {
  label: string;
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    if (!enabled) return;
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
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos &&
        enabled &&
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
  corner,
}: {
  count: number;
  compact?: boolean;
  /** Absolute badge on the icon (collapsed rail / mobile tabs) */
  corner?: boolean;
}) {
  if (count <= 0) return null;
  const text = count > 9 ? "9+" : String(count);

  if (corner || compact) {
    return (
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-brand text-[9px] font-bold leading-none text-brand-foreground",
          corner
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
  /** Collapsed sidebar — labels fade; icon position/size stay fixed */
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
          : flush
            ? "gap-3 py-2.5 text-sm font-medium"
            : // Fixed padding forever — never justify-center (that shifts icons)
              "gap-3 px-3 py-2.5 text-sm font-medium",
        active
          ? "bg-brand-soft text-brand"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
    >
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center",
          compact ? "h-5 w-5" : "h-4 w-4",
        )}
      >
        <Icon className={cn(compact ? "h-5 w-5" : "h-4 w-4")} />
        {compact && <NavBadge count={count} compact />}
        {!compact && !flush && count > 0 && (
          <span
            className={cn(
              "transition-opacity motion-reduce:transition-none",
              rail
                ? "opacity-100 duration-150"
                : "opacity-0 duration-150 pointer-events-none",
            )}
            aria-hidden={!rail}
          >
            <NavBadge count={count} corner />
          </span>
        )}
      </span>
      {!compact && (
        <>
          <span
            className={cn(
              flush ? "truncate whitespace-nowrap" : sidebarLabelClass(!!rail),
            )}
            aria-hidden={rail || undefined}
          >
            {label}
          </span>
          {!flush && count > 0 && (
            <span
              className={cn(sidebarLabelClass(!!rail), "ml-auto flex")}
              aria-hidden={rail || undefined}
            >
              <NavBadge count={count} />
            </span>
          )}
          {flush && <NavBadge count={count} />}
        </>
      )}
      {compact && <span className="leading-none">{label}</span>}
    </Link>
  );

  if (!compact && !flush) {
    return (
      <SidebarTooltip
        label={count > 0 ? `${label} (${count})` : label}
        enabled={!!rail}
      >
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
  /** Collapsed — fade name/theme; avatar stays put */
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
          "flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-accent cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          flush ? "px-0" : "px-2",
        )}
      >
        <Avatar className="h-7 w-7 border border-border/50 shrink-0">
          <AvatarImage src={avatarUrl || ""} alt={displayName} />
          <AvatarFallback className="bg-brand-soft text-brand font-medium text-[10px]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "min-w-0 flex-1 leading-none",
            !flush && sidebarLabelClass(!!rail),
          )}
          aria-hidden={rail || undefined}
        >
          <p className="text-sm font-medium truncate whitespace-nowrap">
            {firstName}
          </p>
        </div>
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu modal={false}>
        <SidebarTooltip label={firstName} enabled={!!rail}>
          {avatarTrigger}
        </SidebarTooltip>
        <DropdownMenuContent
          className="z-[80] w-52"
          side="top"
          align="start"
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

      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex shrink-0 items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50 transition-opacity cursor-pointer motion-reduce:transition-none",
          rail
            ? "opacity-0 duration-150 pointer-events-none"
            : "opacity-100 duration-200 delay-100",
        )}
        aria-label={
          mounted && isDark ? "Switch to light mode" : "Switch to dark mode"
        }
        tabIndex={rail ? -1 : undefined}
        aria-hidden={rail || undefined}
      >
        {mounted && isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  /** Fallback only — preferred role comes from auth once loaded */
  role: AppRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  // Prefer auth profile so pages that default role before /auth/me returns
  // (e.g. owner → "manager") do not flash the wrong nav links.
  const resolvedRole = shellRoleFromProfile(user?.profile.role) ?? role;
  const isManagerShell =
    resolvedRole === "manager" || resolvedRole === "owner";
  usePendingTimeOffSync(isManagerShell && !loading);
  usePendingTimesheetsSync(isManagerShell && !loading);
  useInboxUnreadSync(Boolean(user?.profile.company_id) && !loading);
  const { pendingCount } = usePendingTimeOffSnapshot();
  const { pendingCount: timesheetsPendingCount } =
    usePendingTimesheetsSnapshot();
  const { total: inboxUnread } = useInboxUnreadSnapshot();

  const items = navItemsForRole(resolvedRole);
  const mobileTabs = mobileTabsForRole(resolvedRole);
  const menuExtras = items.filter((item) => !item.mobileTab);
  const homeHref = homeHrefForRole(resolvedRole);
  const badgeFor = (id: string) => {
    if (id === "mgr-requests" && pendingCount > 0) return pendingCount;
    if (id === "mgr-timesheets" && timesheetsPendingCount > 0) {
      return timesheetsPendingCount;
    }
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

  // Hold the shell until auth resolves so we never paint the wrong role's nav.
  if (loading) {
    return (
      <div className="min-h-screen bg-background w-full flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden flex flex-col">
      {/* Desktop sidebar — width + label opacity only; icons never move or resize */}
      <aside
        className={cn(
          "hidden md:flex fixed inset-y-0 left-0 z-40 flex-col overflow-hidden border-r border-border/40 bg-background transition-[width]",
          SIDEBAR_EASE,
          collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W,
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-1.5 border-b border-border/40 px-5">
          <Link
            href={homeHref}
            className="inline-flex min-w-0 items-center gap-1.5"
          >
            <BrandMark size={22} />
            <span
              className={cn(
                "text-lg font-semibold tracking-tight",
                sidebarLabelClass(collapsed),
              )}
              aria-hidden={collapsed || undefined}
            >
              OhShift
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-3">
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
        <div className="shrink-0 space-y-2 border-t border-border/40 p-3">
          <SidebarTooltip label="Expand sidebar" enabled={collapsed}>
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4 shrink-0" />
              ) : (
                <PanelLeftClose className="h-4 w-4 shrink-0" />
              )}
              <span
                className={sidebarLabelClass(collapsed)}
                aria-hidden={collapsed || undefined}
              >
                Collapse
              </span>
            </button>
          </SidebarTooltip>
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
          "flex-1 flex flex-col pb-20 md:pb-0 transition-[padding]",
          SIDEBAR_EASE,
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
