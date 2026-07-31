export type PendingTimeOffType = "vacation" | "sick" | "personal" | "other";
export type PendingTimeOffStatus =
  | "pending"
  | "approved"
  | "denied"
  | "cancelled";

export type PendingTimeOffRequest = {
  id: string;
  employee_id: string;
  type: PendingTimeOffType;
  start_date: string;
  end_date: string;
  note: string | null;
  status: PendingTimeOffStatus;
  employee?: { full_name: string };
  reviewed_by?: { full_name: string };
};

export type PendingTimeOffSnapshot = {
  pending: PendingTimeOffRequest[];
  recent: PendingTimeOffRequest[];
  pendingCount: number;
  loaded: boolean;
  revision: number;
};

const listeners = new Set<() => void>();

let snapshot: PendingTimeOffSnapshot = {
  pending: [],
  recent: [],
  pendingCount: 0,
  loaded: false,
  revision: 0,
};

function emit() {
  for (const listener of listeners) listener();
}

export function getPendingTimeOffSnapshot() {
  return snapshot;
}

export function getPendingTimeOffServerSnapshot(): PendingTimeOffSnapshot {
  return {
    pending: [],
    recent: [],
    pendingCount: 0,
    loaded: false,
    revision: 0,
  };
}

export function subscribePendingTimeOff(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function setPendingTimeOffData(data: {
  pending: PendingTimeOffRequest[];
  recent: PendingTimeOffRequest[];
}) {
  const pendingCount = data.pending.length;
  const same =
    snapshot.loaded &&
    snapshot.pendingCount === pendingCount &&
    snapshot.pending.map((r) => r.id).join() ===
      data.pending.map((r) => r.id).join() &&
    snapshot.recent.map((r) => `${r.id}:${r.status}`).join() ===
      data.recent.map((r) => `${r.id}:${r.status}`).join();

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

export function resetPendingTimeOffStore() {
  snapshot = {
    pending: [],
    recent: [],
    pendingCount: 0,
    loaded: false,
    revision: snapshot.revision + 1,
  };
  emit();
}
