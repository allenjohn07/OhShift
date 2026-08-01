"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import {
  getPendingTimesheetsServerSnapshot,
  getPendingTimesheetsSnapshot,
  resetPendingTimesheetsStore,
  setPendingTimesheetsData,
  subscribePendingTimesheets,
  type PendingTimeEntry,
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
  const api = useApi();
  const { accessToken } = useAuth();

  return useCallback(async () => {
    if (!accessToken) return;
    const res = await api("/time-entries/company");
    const data = await parseApiJson<{
      pending?: PendingTimeEntry[];
      recent?: PendingTimeEntry[];
    }>(res);
    if (!res.ok) return;
    setPendingTimesheetsData({
      pending: data.pending ?? [],
      recent: data.recent ?? [],
    });
  }, [api, accessToken]);
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
