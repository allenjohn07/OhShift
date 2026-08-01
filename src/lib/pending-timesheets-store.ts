export type TimeEntryStatus = "open" | "pending" | "approved" | "denied";

export type PendingTimeEntry = {
  id: string;
  employee_id: string;
  shift_id: string;
  punched_in_at: string;
  punched_out_at: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  status: TimeEntryStatus;
  review_note: string | null;
  employee?: { full_name: string };
  reviewed_by?: { full_name: string };
  shift?: {
    title: string;
    start_time: string;
    end_time: string;
  };
};

export type PendingTimesheetsSnapshot = {
  pending: PendingTimeEntry[];
  recent: PendingTimeEntry[];
  pendingCount: number;
  loaded: boolean;
  revision: number;
};

const listeners = new Set<() => void>();

let snapshot: PendingTimesheetsSnapshot = {
  pending: [],
  recent: [],
  pendingCount: 0,
  loaded: false,
  revision: 0,
};

function emit() {
  for (const listener of listeners) listener();
}

export function getPendingTimesheetsSnapshot() {
  return snapshot;
}

/** Must be referentially stable — useSyncExternalStore compares with Object.is */
const SERVER_SNAPSHOT: PendingTimesheetsSnapshot = {
  pending: [],
  recent: [],
  pendingCount: 0,
  loaded: false,
  revision: 0,
};

export function getPendingTimesheetsServerSnapshot(): PendingTimesheetsSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribePendingTimesheets(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function setPendingTimesheetsData(data: {
  pending: PendingTimeEntry[];
  recent: PendingTimeEntry[];
}) {
  const pendingCount = data.pending.length;
  const same =
    snapshot.loaded &&
    snapshot.pendingCount === pendingCount &&
    snapshot.pending.map((r) => r.id).join() ===
      data.pending.map((r) => r.id).join() &&
    snapshot.recent.map((r) => `${r.id}:${r.status}:${r.clock_in_at}:${r.clock_out_at}`).join() ===
      data.recent
        .map((r) => `${r.id}:${r.status}:${r.clock_in_at}:${r.clock_out_at}`)
        .join();

  if (same) return;

  snapshot = {
    pending: data.pending,
    recent: data.recent,
    pendingCount,
    loaded: true,
    revision: snapshot.revision + 1,
  };
  emit();
}

export function resetPendingTimesheetsStore() {
  snapshot = {
    pending: [],
    recent: [],
    pendingCount: 0,
    loaded: false,
    revision: snapshot.revision + 1,
  };
  emit();
}
