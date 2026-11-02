import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { rpc, unwrap } from "@/lib/rpc";
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
  const { accessToken } = useAuth();

  return useCallback(async () => {
    if (!accessToken) return;
    // Background poll: stay quiet on errors.
    const data = await unwrap(rpc.inbox.unread.$get()).catch(() => null);
    if (!data) return;
    setInboxUnreadData({
      announcements: data.announcements ?? 0,
      messages: data.messages ?? 0,
      total: data.total ?? 0,
    });
  }, [accessToken]);
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
