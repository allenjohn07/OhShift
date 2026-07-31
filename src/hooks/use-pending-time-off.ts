"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import {
  getPendingTimeOffServerSnapshot,
  getPendingTimeOffSnapshot,
  resetPendingTimeOffStore,
  setPendingTimeOffData,
  subscribePendingTimeOff,
  type PendingTimeOffRequest,
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
  const api = useApi();
  const { accessToken } = useAuth();

  return useCallback(async () => {
    if (!accessToken) return;
    const res = await api("/time-off/company");
    const data = await parseApiJson<{
      pending?: PendingTimeOffRequest[];
      recent?: PendingTimeOffRequest[];
    }>(res);
    if (!res.ok) return;
    setPendingTimeOffData({
      pending: data.pending ?? [],
      recent: data.recent ?? [],
    });
  }, [api, accessToken]);
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
