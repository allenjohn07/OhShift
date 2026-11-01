import type { MouseEvent } from "react";

/**
 * In-page section link handler: smooth-scrolls to `#id` without changing the
 * URL. Modified clicks (new tab/window) and missing sections fall back to the
 * link's normal href.
 */
export function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
