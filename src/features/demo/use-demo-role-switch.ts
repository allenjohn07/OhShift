import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { homeHrefForRole, type AppRole, type RoutePath } from "@/lib/nav";
import { rpc, unwrap } from "@/lib/rpc";
import { completeDemoStep } from "./tour-store";

/** Shortest time the page shows its loading spinner during a role switch. */
const MIN_SWITCH_MS = 700;

export type DemoDestination = { to: RoutePath; target?: string };

/**
 * Where to go once a role switch has rendered. Navigating straight away loses
 * to the current page's AuthGuard, which redirects to the new role's home as
 * soon as it sees the new role; `DemoChrome` navigates after that instead.
 */
let pending: DemoDestination | null = null;

export function takePendingDemoDestination() {
  const next = pending;
  pending = null;
  return next;
}

/**
 * The role being switched to while a switch is in flight (null otherwise).
 * Module state, not component state: the page under the switch is replaced
 * mid-way, and the loading spinner must stay up across that.
 */
let switchingTo: AppRole | null = null;
const listeners = new Set<() => void>();

function setSwitchingTo(role: AppRole | null) {
  switchingTo = role;
  listeners.forEach((notify) => notify());
}

/** Ends the switch: called once the destination page has been navigated to. */
export function finishDemoSwitch() {
  setSwitchingTo(null);
}

export function useDemoSwitching() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => switchingTo,
    () => null,
  );
}

/** Signs in as the sandbox's owner / manager / employee persona. */
export function useDemoRoleSwitch() {
  const { adoptSession } = useAuth();
  const switching = useDemoSwitching();

  const switchRole = useCallback(async (role: AppRole, destination?: DemoDestination) => {
    setSwitchingTo(role);
    try {
      // A deliberate pause with the page's spinner up, so the change of view
      // reads as a step instead of an abrupt swap.
      const [session] = await Promise.all([
        unwrap(rpc.demo.switch.$post({ json: { role } }), "Could not switch views"),
        new Promise((resolve) => setTimeout(resolve, MIN_SWITCH_MS)),
      ]);
      pending = destination ?? { to: homeHrefForRole(role) };
      adoptSession(session);
      if (role === "employee") completeDemoStep("employee-view");
      return true;
    } catch (err) {
      setSwitchingTo(null);
      toast.error(err instanceof Error ? err.message : "Could not switch views");
      return false;
    }
  }, [adoptSession]);

  return { switchRole, switching };
}
