import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter, type AnyRouter } from "@tanstack/react-router";
import { ArrowLeft, RotateCw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { startOfWeek } from "@/lib/dates";
import { isDemoProfile } from "@/lib/demo";
import { homeHrefForRole, shellRoleFromProfile } from "@/lib/nav";
import { queries } from "@/lib/queries";
import { rpc, unwrap } from "@/lib/rpc";
import { setTourPanelOpen } from "./tour-store";

/** Shortest time the setup screen stays up, so it reads as a step, not a blink. */
const MIN_SCREEN_MS = 900;

/**
 * Loads the Overview's code and the data its first screen shows (with the new
 * session's token), so the demo opens fully rendered instead of popping in.
 * Failures are ignored: the page loads anything missing itself.
 */
async function prepareOverview(queryClient: QueryClient, router: AnyRouter) {
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  await Promise.allSettled([
    router.preloadRoute({ to: "/company/dashboard" }),
    queryClient.prefetchQuery(queries.companyDashboard()),
    queryClient.prefetchQuery(queries.companyShifts(weekStart.toISOString(), weekEnd.toISOString())),
    queryClient.prefetchQuery(queries.activity()),
    queryClient.prefetchQuery(queries.companyTimeOff()),
    queryClient.prefetchQuery(queries.companyTimesheets()),
    queryClient.prefetchQuery(queries.inboxUnread()),
  ]);
}

/**
 * `/demo` (and the root of demo.ohshifts.com): creates a private sandbox
 * company, signs the visitor in as its owner and opens the tour. A visitor
 * who already has a demo session just goes back to it. This screen stays up
 * until the Overview is ready to show.
 */
export default function DemoStartPage() {
  const { user, loading, adoptSession } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    // A fast local API would swap screens within ~200ms, which reads as a flash.
    const minimumScreenTime = new Promise((resolve) => setTimeout(resolve, MIN_SCREEN_MS));
    try {
      const session = await unwrap(
        rpc.demo.start.$post(
          { json: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
          // The API can be cold-starting; give it time.
          { init: { signal: AbortSignal.timeout(60_000) } },
        ),
        "Could not start the demo",
      );
      // Stores the token (and clears any old cache) before the prefetch below.
      adoptSession(session);
      await Promise.all([prepareOverview(queryClient, router), minimumScreenTime]);
      setTourPanelOpen(true);
      await navigate({ to: "/company/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo");
    }
  }, [adoptSession, navigate, queryClient, router]);

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    const role = shellRoleFromProfile(user?.profile.role);
    if (user && role && isDemoProfile(user.profile)) {
      navigate({ to: homeHrefForRole(role), replace: true });
      return;
    }
    void start();
  }, [loading, user, navigate, start]);

  return (
    <div className="animate-fade-in flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <BrandMark size={40} />
      {error ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">The demo didn't start</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground" role="alert">{error}</p>
          <div className="mt-6 flex gap-2">
            <Link to="/">
              <Button variant="ghost" tooltip="Back to the OhShifts home page">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Button onClick={() => void start()} tooltip="Try starting the demo again">
              <RotateCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Setting up your demo café…</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            We're creating a private company with a team, schedules and requests just for you. Nothing you do here affects anyone else.
          </p>
          <div className="mt-8 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" aria-label="Loading" />
        </>
      )}
    </div>
  );
}
