export type InboxUnreadSnapshot = {
  announcements: number;
  messages: number;
  total: number;
  loaded: boolean;
  revision: number;
};

const listeners = new Set<() => void>();

let snapshot: InboxUnreadSnapshot = {
  announcements: 0,
  messages: 0,
  total: 0,
  loaded: false,
  revision: 0,
};

function emit() {
  for (const listener of listeners) listener();
}

export function getInboxUnreadSnapshot() {
  return snapshot;
}

/** Must be referentially stable — useSyncExternalStore compares with Object.is */
const SERVER_SNAPSHOT: InboxUnreadSnapshot = {
  announcements: 0,
  messages: 0,
  total: 0,
  loaded: false,
  revision: 0,
};

export function getInboxUnreadServerSnapshot(): InboxUnreadSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeInboxUnread(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function setInboxUnreadData(data: {
  announcements: number;
  messages: number;
  total: number;
}) {
  const same =
    snapshot.loaded &&
    snapshot.announcements === data.announcements &&
    snapshot.messages === data.messages &&
    snapshot.total === data.total;

  if (same) return;

  snapshot = {
    announcements: data.announcements,
    messages: data.messages,
    total: data.total,
    loaded: true,
    revision: snapshot.revision + 1,
  };
  emit();
}

export function resetInboxUnreadStore() {
  snapshot = {
    announcements: 0,
    messages: 0,
    total: 0,
    loaded: false,
    revision: snapshot.revision + 1,
  };
  emit();
}
