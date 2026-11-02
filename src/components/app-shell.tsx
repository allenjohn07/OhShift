import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { IconTooltip } from "@/components/icon-tooltip";
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
  type RoutePath,
} from "@/lib/nav";
import {
  useInboxUnread,
  usePendingTimeOff,
  usePendingTimesheets,
} from "@/hooks/use-live-badges";

const SIDEBAR_COLLAPSED_KEY = "ohshift-sidebar-collapsed";
/** Expanded / collapsed widths — icons sit on a fixed left gutter in both states */
const SIDEBAR_EXPANDED_W = "w-60";
const SIDEBAR_COLLAPSED_W = "w-16";
const SIDEBAR_EXPANDED_PL = "md:pl-60";
const SIDEBAR_COLLAPSED_PL = "md:pl-16";
/** No overshoot — previous curve felt like a bounce */
const SIDEBAR_EASE =
  "duration-150 ease-out motion-reduce:transition-none";

/** Neon-style label fade: hide quickly on collapse, reveal after width opens */
function sidebarLabelClass(collapsed: boolean) {
  return cn(
    "min-w-0 truncate whitespace-nowrap transition-opacity motion-reduce:transition-none",
    collapsed
      ? "opacity-0 duration-75 pointer-events-none"
      : "opacity-100 duration-100 delay-75",
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
  "flex w-full flex-col items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer";

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
          "absolute flex items-center justify-center rounded-full bg-brand text-[9px] font-semibold leading-none text-brand-foreground",
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
    <span className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-sm bg-brand-soft px-1 text-[11px] font-medium tabular-nums text-brand">
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
  href: RoutePath;
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
      to={href}
      onClick={onClick}
      className={cn(
        "group/nav flex items-center rounded-md transition-colors cursor-pointer",
        compact
          ? compactTabClass
          : flush
            ? "gap-2.5 px-2 py-2 text-sm"
            : // Fixed padding forever — never justify-center (that shifts icons)
              "h-8 w-full gap-2.5 px-3 text-sm",
        compact
          ? active
            ? "text-brand"
            : "text-muted-foreground hover:text-foreground"
          : active
            ? "bg-accent font-medium text-foreground"
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
        <Icon
          className={cn(
            compact ? "h-5 w-5" : "h-4 w-4",
            !compact && active && "text-brand",
          )}
        />
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
      {compact && (
        <span data-tab-label className="leading-none">
          {label}
        </span>
      )}
    </Link>
  );

  if (!compact && !flush) {
    return (
      <IconTooltip
        label={count > 0 ? `${label} (${count})` : label}
        enabled={!!rail}
        className="flex w-full"
      >
        {link}
      </IconTooltip>
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
          "flex min-w-0 w-full items-center rounded-md text-left transition-colors hover:bg-accent cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          // flush = mobile sheet: same 20px icon column, gap and padding as the link rows
          flush ? "h-12 gap-3" : "h-8 gap-2 px-2 pr-3",
        )}
      >
        <Avatar className={cn("shrink-0 rounded-sm", flush ? "h-5 w-5" : "h-6 w-6")}>
          <AvatarImage src={avatarUrl || ""} alt={displayName} />
          <AvatarFallback
            className={cn(
              "rounded-sm bg-brand-soft text-brand font-medium",
              flush ? "text-[8px]" : "text-[10px]",
            )}
          >
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
          <p className={cn("font-medium truncate whitespace-nowrap", flush ? "text-base" : "text-sm")}>
            {flush ? displayName : firstName}
          </p>
        </div>
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <DropdownMenu modal={false}>
          <IconTooltip
            label={firstName}
            enabled={!!rail}
            className="flex w-full min-w-0"
          >
            {avatarTrigger}
          </IconTooltip>
          <DropdownMenuContent
            className="z-[80] w-52 border border-border shadow-none!"
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
            <Link to="/profile" onClick={onNavigate}>
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
              variant="destructive"
              className="cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rail is too narrow for two buttons — theme lives in the avatar menu there. */}
      {!rail && (
        <IconTooltip
          label={mounted && isDark ? "Switch to light mode" : "Switch to dark mode"}
          side="top"
        >
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
              // flush: icon lines up with the rows' right padding
              flush ? "h-12 w-12 justify-end" : "h-8 w-8",
            )}
            aria-label={mounted && isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted && isDark ? (
              <Sun className={flush ? "h-5 w-5" : "h-4 w-4"} />
            ) : (
              <Moon className={flush ? "h-5 w-5" : "h-4 w-4"} />
            )}
          </button>
        </IconTooltip>
      )}
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
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  // Prefer auth profile so pages that default role before /auth/me returns
  // (e.g. owner → "manager") do not flash the wrong nav links.
  const resolvedRole = shellRoleFromProfile(user?.profile.role) ?? role;
  const isManagerShell =
    resolvedRole === "manager" || resolvedRole === "owner";
  const pendingCount =
    usePendingTimeOff(isManagerShell && !loading).data?.pending.length ?? 0;
  const timesheetsPendingCount =
    usePendingTimesheets(isManagerShell && !loading).data?.pending.length ?? 0;
  const inboxUnread =
    useInboxUnread(Boolean(user?.profile.company_id) && !loading).data?.total ?? 0;

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Mobile sheet insets = where the first tab label starts / the last one ends,
  // so the sheet's icons line up with "Overview" (left) and "Close" (right).
  const tabRowRef = useRef<HTMLDivElement>(null);
  const [sheetInset, setSheetInset] = useState<{ left: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const measure = () => {
      const row = tabRowRef.current;
      const labels = row?.querySelectorAll<HTMLElement>("[data-tab-label]");
      if (!row || !labels || labels.length === 0) return;
      const box = row.getBoundingClientRect();
      const first = labels[0]!.getBoundingClientRect();
      const last = labels[labels.length - 1]!.getBoundingClientRect();
      setSheetInset({
        left: Math.round(first.left - box.left),
        right: Math.round(box.right - last.right),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape closes the account popup first, not the whole menu behind it.
      if (document.querySelector("[data-slot=dropdown-menu-content]")) return;
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("Failed to logout");
    }
  };

  const displayName = user?.profile.full_name || "User";
  const email = user?.email;
  const avatarUrl = user?.profile.avatar_url;
  const companyName = user?.profile.companies?.name;

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
          "hidden md:flex fixed inset-y-0 left-0 z-40 flex-col overflow-hidden border-r border-border bg-sidebar transition-[width]",
          SIDEBAR_EASE,
          collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W,
        )}
      >
        {/* Workspace header (Notion-style) */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <Link
            to={homeHref}
            className="flex h-9 min-w-0 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-accent"
          >
            <span className="flex h-6 w-7 shrink-0 items-center justify-center">
              <BrandMark size={20} />
            </span>
            <span
              className={cn(
                "flex min-w-0 flex-col leading-tight",
                sidebarLabelClass(collapsed),
              )}
              aria-hidden={collapsed || undefined}
            >
              <span className="truncate text-sm font-semibold">
                {companyName || "OhShifts"}
              </span>
              {companyName && (
                <span className="truncate text-[11px] text-muted-foreground">
                  OhShifts workspace
                </span>
              )}
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-px overflow-x-hidden overflow-y-auto px-3 pb-3">
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
        <div className="shrink-0 space-y-px border-t border-border p-3">
          <IconTooltip
            label="Expand sidebar"
            enabled={collapsed}
            className="flex w-full"
          >
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
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
          </IconTooltip>
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
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-12 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-full items-center px-4 sm:px-6">
          <Link to={homeHref} className="inline-flex min-w-0 items-center gap-2">
            <BrandMark size={20} />
            <span className="truncate text-sm font-semibold">
              {companyName || "OhShifts"}
            </span>
          </Link>
        </div>
      </header>

      {/* Mobile menu backdrop — sits under the tab bar; tap to close */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => setMenuOpen(false)}
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="h-12 w-full shrink-0 md:hidden" />
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

      {/* Mobile bottom tabs (+ Menu, which opens the sheet above) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background">
        {/* Bottom sheet — sized to its content; slides up from behind the tab bar.
            Side insets are measured from the tab labels (see sheetInset). */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-full max-h-[75dvh] overflow-y-auto rounded-t-xl border-y border-border bg-background pt-1 pb-1 transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            menuOpen ? "visible translate-y-0" : "pointer-events-none invisible translate-y-full",
          )}
          style={
            sheetInset
              ? { paddingLeft: sheetInset.left, paddingRight: sheetInset.right }
              : { paddingLeft: 16, paddingRight: 16 }
          }
          aria-hidden={!menuOpen}
        >
          {menuExtras.length > 0 && (
            <nav className="flex flex-col">
              {menuExtras.map((item) => {
                const active = isNavActive(pathname, item.href);
                const count = badgeFor(item.id) ?? 0;
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 border-b border-border py-3"
                    aria-current={active ? "page" : undefined}
                    tabIndex={menuOpen ? undefined : -1}
                  >
                    <item.icon
                      className={cn("h-5 w-5", active ? "text-brand" : "text-muted-foreground")}
                    />
                    <span className={cn("text-base font-medium", active && "text-brand")}>
                      {item.label}
                    </span>
                    {count > 0 && (
                      <span className="ml-auto rounded-sm bg-brand-soft px-1.5 text-sm font-medium text-brand tabular-nums">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
          {/* Name (menu: Profile, Log out) + theme — same as the desktop sidebar */}
          <div className="pt-2">
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

        <div
          ref={tabRowRef}
          className="relative z-10 flex gap-1 bg-background px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
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
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                compactTabClass,
                menuOpen || menuExtras.some((item) => isNavActive(pathname, item.href)) ||
                  isNavActive(pathname, "/profile")
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span data-tab-label className="leading-none">
                {menuOpen ? "Close" : "Menu"}
              </span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
