const HIGHLIGHT_MS = 4000;
const WAIT_MS = 4000;

/**
 * Scrolls to the first visible `[data-tour="<target>"]` element and outlines it
 * for a few seconds. Waits briefly for it to render (after a navigation or a
 * role switch the page may still be loading).
 */
export function highlightTourTarget(target: string) {
  const startedAt = Date.now();
  const find = () =>
    [...document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`)].find(
      (el) => el.getClientRects().length > 0,
    );
  const tick = () => {
    const el = find();
    if (!el) {
      if (Date.now() - startedAt < WAIT_MS) window.setTimeout(tick, 100);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    el.setAttribute("data-tour-highlight", "");
    window.setTimeout(() => el.removeAttribute("data-tour-highlight"), HIGHLIGHT_MS);
  };
  tick();
}
