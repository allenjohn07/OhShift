import { useEffect } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Compass, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { isDemoHost, isDemoProfile, mainSiteUrl } from "@/lib/demo";
import { shellRoleFromProfile, type AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { tourProgress } from "./quests";
import { highlightTourTarget } from "./highlight";
import { QuestPanel } from "./quest-panel";
import { setTourPanelOpen, setTourSandbox, useTour } from "./tour-store";
import { finishDemoSwitch, takePendingDemoDestination, useDemoRoleSwitch, useDemoSwitching } from "./use-demo-role-switch";
import { Spinner } from "@/components/ui/spinner";

const VIEWS: Array<{ role: AppRole; label: string; persona: string }> = [
  { role: "owner", label: "Owner", persona: "Alex, who owns the café" },
  { role: "manager", label: "Manager", persona: "Priya, the shift lead" },
  { role: "employee", label: "Employee", persona: "Sam, a barista" },
];

/** Leaves the demo for the real site: sign up, or just exit. */
export function useLeaveDemo() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (to: "/company/register" | "/") => {
    // On demo.ohshifts.com the real site is another origin; the demo session
    // stays on the demo origin, so coming back resumes the same sandbox.
    if (isDemoHost()) {
      window.location.assign(mainSiteUrl(to));
      return;
    }
    logout();
    void navigate({ to, replace: true });
  };
}

/** Demo bar (role switcher, tour, sign-up) + quest panel; renders nothing outside a demo. */
export function DemoChrome() {
  const { user } = useAuth();
  const isDemo = isDemoProfile(user?.profile);
  const sandbox = isDemo ? user?.profile.company_id ?? null : null;
  const role = shellRoleFromProfile(user?.profile.role);
  const { done, panelOpen } = useTour();
  const { switchRole, switching } = useDemoRoleSwitch();
  const leave = useLeaveDemo();
  const router = useRouter();

  useEffect(() => {
    setTourSandbox(sandbox);
    return () => setTourSandbox(null);
  }, [sandbox]);

  // After a role switch, the page on screen may be one the new role can't
  // see: its AuthGuard redirects to the role's home, and keeps doing so while
  // that page stays mounted (until the next route has loaded). So wait for the
  // router to settle, then go. Not cancelled on unmount: this shell may be the
  // page being replaced.
  useEffect(() => {
    const next = takePendingDemoDestination();
    if (!next) return;
    void (async () => {
      const tick = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      await tick(0);
      for (let i = 0; i < 150 && router.state.status !== "idle"; i++) await tick(20);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await router.navigate({ to: next.to }).finally(finishDemoSwitch);
      if (next.target) highlightTourTarget(next.target);
    })();
  }, [role, router]);

  if (!isDemo || !role) return null;
  const { completed, total } = tourProgress(done);

  return (
    <>
      {/* Full-width band; content uses PageMain's width and gutters so it lines up with the page below. */}
      <div className="border-b border-border bg-muted" data-testid="demo-bar">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-8 lg:px-12">
          <span className="rounded-sm bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">Live demo</span>
          <span className="hidden text-sm text-muted-foreground lg:inline">
            Viewing as <span className="font-medium text-foreground">{user?.profile.full_name}</span>
          </span>
          <div role="group" aria-label="View the demo as" className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
            {VIEWS.map((view) => (
              <Button
                key={view.role}
                size="xs"
                variant="ghost"
                aria-pressed={(switching ?? role) === view.role}
                title={`View as ${view.persona}`}
                disabled={switching !== null}
                onClick={() => role !== view.role && void switchRole(view.role)}
                className={cn("px-2", (switching ?? role) === view.role ? "bg-accent text-foreground" : "text-muted-foreground")}
              >
                {view.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setTourPanelOpen(!panelOpen)} aria-expanded={panelOpen}>
              <Compass />
              Tour <span className="tabular-nums text-muted-foreground">{completed}/{total}</span>
            </Button>
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => leave("/company/register")}>
              Create your company
            </Button>
            {/* Label from sm up (there's room); icon only on phones. */}
            <Button size="sm" variant="ghost" aria-label="Exit demo" onClick={() => leave("/")}>
              <LogOut />
              <span className="hidden sm:inline">Exit demo</span>
            </Button>
          </div>
        </div>
      </div>
      {panelOpen && <QuestPanel role={role} switchRole={switchRole} switching={switching !== null} onSignUp={() => leave("/company/register")} />}
    </>
  );
}

/**
 * Page content, or the standard page spinner while the demo switches role.
 * Hiding the page also unmounts its AuthGuard, so it can't redirect mid-switch.
 */
export function DemoPageGate({ children }: { children: React.ReactNode }) {
  const switching = useDemoSwitching();
  if (!switching) return <>{children}</>;
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]" role="status" aria-label="Switching view">
      <Spinner className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}
