"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/hooks/use-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import {
  getInboxUnreadServerSnapshot,
  getInboxUnreadSnapshot,
  resetInboxUnreadStore,
  setInboxUnreadData,
  subscribeInboxUnread,
  type InboxUnreadSnapshot,
} from "@/lib/inbox-unread-store";

export function useInboxUnreadSnapshot(): InboxUnreadSnapshot {
  return useSyncExternalStore(
    subscribeInboxUnread,
    getInboxUnreadSnapshot,
    getInboxUnreadServerSnapshot,
  );
}

export function useRefreshInboxUnread() {
  const api = useApi();
  const { accessToken } = useAuth();

  return useCallback(async () => {
    if (!accessToken) return;
    const res = await api("/inbox/unread");
    const data = await parseApiJson<{
      announcements?: number;
      messages?: number;
      total?: number;
    }>(res);
    if (!res.ok) return;
    setInboxUnreadData({
      announcements: data.announcements ?? 0,
      messages: data.messages ?? 0,
      total: data.total ?? 0,
    });
  }, [api, accessToken]);
}

/** Polls inbox unread for any company member; keep mounted in AppShell. */
export function useInboxUnreadSync(enabled: boolean) {
  const refresh = useRefreshInboxUnread();
  const { accessToken } = useAuth();
  const active = enabled && Boolean(accessToken);

  useEffect(() => {
    if (!active) resetInboxUnreadStore();
  }, [active]);

  useVisiblePoll(active, refresh);

  return { refresh };
}
