import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { rpc, unwrap } from "@/lib/rpc";
import {
  getPendingTimesheetsServerSnapshot,
  getPendingTimesheetsSnapshot,
  resetPendingTimesheetsStore,
  setPendingTimesheetsData,
  subscribePendingTimesheets,
  type PendingTimesheetsSnapshot,
} from "@/lib/pending-timesheets-store";

export function usePendingTimesheetsSnapshot(): PendingTimesheetsSnapshot {
  return useSyncExternalStore(
    subscribePendingTimesheets,
    getPendingTimesheetsSnapshot,
    getPendingTimesheetsServerSnapshot,
  );
}

export function useRefreshPendingTimesheets() {
  const { accessToken } = useAuth();

  return useCallback(async () => {
    if (!accessToken) return;
    // Background poll: stay quiet on errors.
    const data = await unwrap(rpc["time-entries"].company.$get()).catch(() => null);
    if (!data) return;
    setPendingTimesheetsData({
      pending: data.pending ?? [],
      recent: data.recent ?? [],
    });
  }, [accessToken]);
}

/** Polls company time entries for managers; keep mounted in AppShell. */
export function usePendingTimesheetsSync(enabled: boolean) {
  const refresh = useRefreshPendingTimesheets();
  const { accessToken } = useAuth();
  const active = enabled && Boolean(accessToken);

  useEffect(() => {
    if (!active) resetPendingTimesheetsStore();
  }, [active]);

  useVisiblePoll(active, refresh);

  return { refresh };
}
