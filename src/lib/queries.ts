import { QueryCache, QueryClient, infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiRequestError, rpc, unwrap } from "@/lib/rpc";

/**
 * Data another role can change (time-off, schedules, inbox, timesheets) refetches
 * this often while the tab is visible — TanStack Query pauses intervals in hidden
 * tabs and refetches on window focus.
 */
export const LIVE_MS = 8_000;

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** Toast this (or the API's message) if the first load fails. */
      errorMessage?: string;
    };
  }
}

const isClientError = (error: unknown) =>
  error instanceof ApiRequestError && error.status >= 400 && error.status < 500;

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Toast the initial load only — background refetch errors stay quiet.
        if (query.state.data !== undefined || !query.meta?.errorMessage) return;
        if (error instanceof ApiRequestError && error.status === 401) return;
        toast.error(error.message || query.meta.errorMessage);
      },
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        // 4xx won't fix itself on retry.
        retry: (count, error) => !isClientError(error) && count < 1,
      },
    },
  });
}

/** Query keys are grouped so mutations can invalidate a whole area by prefix. */
export const queries = {
  employeeDashboard: () =>
    queryOptions({
      queryKey: ["dashboard", "employee"],
      meta: { errorMessage: "Could not load your dashboard" },
      queryFn: () => unwrap(rpc.dashboard.employee.$get({ query: {} })),
      refetchInterval: LIVE_MS,
    }),
  companyDashboard: () =>
    queryOptions({
      queryKey: ["dashboard", "company"],
      meta: { errorMessage: "Could not load the company dashboard" },
      queryFn: () => unwrap(rpc.dashboard.company.$get({ query: {} })),
      refetchInterval: LIVE_MS,
    }),
  profile: () =>
    queryOptions({
      queryKey: ["dashboard", "profile"],
      queryFn: () => unwrap(rpc.dashboard.profile.$get(), "Could not load profile"),
      meta: { errorMessage: "Could not load profile" },
    }),
  activity: () =>
    queryOptions({
      queryKey: ["company", "activity"],
      queryFn: () => unwrap(rpc.company.activity.$get()),
      refetchInterval: LIVE_MS,
    }),
  availability: () =>
    queryOptions({
      queryKey: ["availability"],
      queryFn: () =>
        unwrap(rpc.availability.$get(), "Failed to load availability"),
      meta: { errorMessage: "Failed to load availability" },
    }),
  eligible: (query: {
    start: string;
    end: string;
    timezone: string;
    designation?: string;
  }) =>
    queryOptions({
      queryKey: ["shifts", "eligible", query],
      queryFn: () =>
        unwrap(
          rpc.shifts.eligible.$get({ query }),
          "Failed to load eligible team members",
        ),
    }),
  myShifts: (from?: string, to?: string) =>
    queryOptions({
      queryKey: ["shifts", "mine", from, to],
      queryFn: () => unwrap(rpc.shifts.mine.$get({ query: { from, to } }), "Failed to load shifts"),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load shifts" },
    }),
  companyShifts: (from: string, to: string) => queryOptions({
    queryKey: ["shifts", "company", from, to],
    queryFn: () => unwrap(rpc.shifts.company.$get({ query: { from, to } }), "Failed to load schedule"),
    refetchInterval: LIVE_MS,
    meta: { errorMessage: "Failed to load schedule" },
  }),
  threadHistory: (id: string) => infiniteQueryOptions({
    queryKey: ["messages", "conversations", id, "history"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(rpc.messages.conversations[":id"].$get({ param: { id }, query: { before: pageParam } }), "Failed to load older messages"),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    meta: { errorMessage: "Failed to load older messages" },
  }),
  myTimeOff: () =>
    queryOptions({
      queryKey: ["time-off", "mine"],
      queryFn: () =>
        unwrap(rpc["time-off"].$get(), "Failed to load time-off requests"),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load time-off requests" },
    }),
  companyTimeOff: () =>
    queryOptions({
      queryKey: ["time-off", "company"],
      queryFn: () => unwrap(rpc["time-off"].company.$get()),
      refetchInterval: LIVE_MS,
    }),
  companyTimesheets: () =>
    queryOptions({
      queryKey: ["time-entries", "company"],
      queryFn: () => unwrap(rpc["time-entries"].company.$get()),
      refetchInterval: LIVE_MS,
    }),
  activeEntry: () =>
    queryOptions({
      queryKey: ["time-entries", "active"],
      queryFn: () =>
        unwrap(rpc["time-entries"].active.$get(), "Failed to load clock status"),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load clock status" },
    }),
  myEntries: (from: string, to: string) =>
    queryOptions({
      queryKey: ["time-entries", "mine", from, to],
      queryFn: () =>
        unwrap(
          rpc["time-entries"].mine.$get({ query: { from, to } }),
          "Failed to load hours",
        ),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load hours" },
    }),
  inboxUnread: () =>
    queryOptions({
      queryKey: ["inbox", "unread"],
      queryFn: () => unwrap(rpc.inbox.unread.$get()),
      refetchInterval: LIVE_MS,
    }),
  announcements: () =>
    queryOptions({
      queryKey: ["announcements"],
      queryFn: () =>
        unwrap(rpc.announcements.$get(), "Failed to load announcements"),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load announcements" },
    }),
  conversations: () =>
    queryOptions({
      queryKey: ["messages", "conversations"],
      queryFn: () =>
        unwrap(rpc.messages.conversations.$get(), "Failed to load conversations"),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load conversations" },
    }),
  thread: (id: string) =>
    queryOptions({
      queryKey: ["messages", "conversations", id],
      queryFn: () =>
        unwrap(
          rpc.messages.conversations[":id"].$get({ param: { id }, query: {} }),
          "Failed to load messages",
        ),
      refetchInterval: LIVE_MS,
      meta: { errorMessage: "Failed to load messages" },
    }),
  directory: () =>
    queryOptions({
      queryKey: ["messages", "directory"],
      queryFn: () => unwrap(rpc.messages.directory.$get()),
    }),
};
