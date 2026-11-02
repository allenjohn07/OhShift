import { useSyncExternalStore } from "react";

/**
 * Personal display preferences, saved on this device (localStorage).
 * Read with `getDisplayPrefs()` at render time, or `useDisplayPrefs()` to
 * re-render on change.
 */
export type TimeFormat = "12h" | "24h";
export type WeekStart = "monday" | "sunday";
export type DisplayPrefs = { timeFormat: TimeFormat; weekStartsOn: WeekStart };

const KEY = "ohshift_display_prefs";
const DEFAULTS: DisplayPrefs = { timeFormat: "12h", weekStartsOn: "monday" };

let cache: DisplayPrefs | null = null;
const listeners = new Set<() => void>();

function read(): DisplayPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      timeFormat: raw.timeFormat === "24h" ? "24h" : "12h",
      weekStartsOn: raw.weekStartsOn === "sunday" ? "sunday" : "monday",
    };
  } catch {
    return DEFAULTS;
  }
}

export function getDisplayPrefs(): DisplayPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  return (cache ??= read());
}

export function setDisplayPrefs(patch: Partial<DisplayPrefs>) {
  cache = { ...getDisplayPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDisplayPrefs() {
  return useSyncExternalStore(subscribe, getDisplayPrefs, () => DEFAULTS);
}
