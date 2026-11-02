import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { queries } from "@/lib/queries";
import type { ApiData } from "@/lib/rpc";
import type { rpc } from "@/lib/rpc";

/**
 * Live queues behind the nav badges. AppShell mounts them (badges); pages use
 * the same hooks, so both read one cached query and refresh together.
 */
export function usePendingTimeOff(enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    ...queries.companyTimeOff(),
    enabled: enabled && Boolean(accessToken),
  });
}

export function usePendingTimesheets(enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    ...queries.companyTimesheets(),
    enabled: enabled && Boolean(accessToken),
  });
}

export function useInboxUnread(enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    ...queries.inboxUnread(),
    enabled: enabled && Boolean(accessToken),
  });
}

export type CompanyTimeEntry = ApiData<
  typeof rpc["time-entries"]["company"]["$get"]
>["pending"][number];
