import { useMemo, useSyncExternalStore } from "react";
import { isQuestId, type QuestId } from "./quests";

/**
 * Demo tour progress, kept in localStorage per sandbox (company id), so a new
 * sandbox starts a fresh tour. Outside a demo session there is no sandbox and
 * `completeDemoStep` does nothing, so app code can call it unconditionally.
 */
const PROGRESS_KEY = (sandbox: string) => `ohshift-demo-tour:${sandbox}`;
const PANEL_KEY = "ohshift-demo-tour-open";
const CHANGE_EVENT = "ohshift-demo-tour";

let sandbox: string | null = null;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: the tour just won't remember progress.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function parseProgress(raw: string | null): Set<QuestId> {
  try {
    const list: unknown = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((id): id is QuestId => typeof id === "string" && isQuestId(id)) : []);
  } catch {
    return new Set();
  }
}

/** Called by the demo bar while a demo session is active (null when it ends). */
export function setTourSandbox(id: string | null) {
  if (sandbox === id) return;
  sandbox = id;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Marks a quest done (also used by "Skip"); the panel's checklist shows the tick. */
export function completeDemoStep(id: QuestId) {
  if (!sandbox) return;
  const done = parseProgress(read(PROGRESS_KEY(sandbox)));
  if (done.has(id)) return;
  done.add(id);
  write(PROGRESS_KEY(sandbox), JSON.stringify([...done]));
}

export function resetTour() {
  if (sandbox) write(PROGRESS_KEY(sandbox), "[]");
  setTourPanelOpen(true);
}

export function setTourPanelOpen(open: boolean) {
  write(PANEL_KEY, open ? "1" : "0");
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTour() {
  const raw = useSyncExternalStore(subscribe, () => (sandbox ? read(PROGRESS_KEY(sandbox)) : null), () => null);
  const panel = useSyncExternalStore(subscribe, () => read(PANEL_KEY), () => null);
  const done = useMemo(() => parseProgress(raw), [raw]);
  return { done, panelOpen: panel !== "0" };
}
