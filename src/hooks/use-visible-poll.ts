"use client";

import { useEffect, useRef } from "react";

/** Default interval for cross-user live updates (employee ↔ manager). */
export const DEFAULT_POLL_MS = 8_000;

/**
 * Poll while the tab is visible; also refresh on window focus / visibility restore.
 * Use for any data that another role can change (time-off, requests, schedules, etc.).
 */
export function useVisiblePoll(
  enabled: boolean,
  tick: () => void | Promise<void>,
  intervalMs: number = DEFAULT_POLL_MS,
) {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void tickRef.current();
    };

    run();
    const id = window.setInterval(run, intervalMs);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, intervalMs]);
}
