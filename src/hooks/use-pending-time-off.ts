import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { rpc, unwrap } from "@/lib/rpc";
import {
  getPendingTimeOffServerSnapshot,
  getPendingTimeOffSnapshot,
  resetPendingTimeOffStore,
  setPendingTimeOffData,
  subscribePendingTimeOff,
  type PendingTimeOffSnapshot,
} from "@/lib/pending-time-off-store";

export function usePendingTimeOffSnapshot(): PendingTimeOffSnapshot {
  return useSyncExternalStore(
    subscribePendingTimeOff,
    getPendingTimeOffSnapshot,
    getPendingTimeOffServerSnapshot,
  );
}

export function useRefreshPendingTimeOff() {
  const { accessToken } = useAuth();

  return useCallback(async () => {
    if (!accessToken) return;
    // Background poll: stay quiet on errors.
    const data = await unwrap(rpc["time-off"].company.$get()).catch(() => null);
    if (!data) return;
    setPendingTimeOffData({
      pending: data.pending ?? [],
      recent: data.recent ?? [],
    });
  }, [accessToken]);
}

/** Polls company time-off for managers; keep mounted in AppShell. */
export function usePendingTimeOffSync(enabled: boolean) {
  const refresh = useRefreshPendingTimeOff();
  const { accessToken } = useAuth();
  const active = enabled && Boolean(accessToken);

  useEffect(() => {
    if (!active) resetPendingTimeOffStore();
  }, [active]);

  useVisiblePoll(active, refresh);

  return { refresh };
}
