/** Where "Try the live demo" goes: demo.ohshifts.com in production, `/demo` locally. */
export const DEMO_URL: string = import.meta.env.VITE_DEMO_URL || "/demo";

/** The demo is on another origin (demo.ohshifts.com), so reaching it is a full page load. */
export const DEMO_IS_EXTERNAL = /^https?:\/\//.test(DEMO_URL);

/** next-themes' storage key; index.html applies it (and a carried ?theme=) before first paint. */
const THEME_KEY = "theme";

/**
 * `url` with the visitor's theme attached. The demo subdomain and the main
 * site have separate storage, so without this a light-theme visitor would
 * land on the other site in the default (dark) theme.
 */
function withTheme(url: URL, theme?: string) {
  let value = theme;
  try {
    value ??= localStorage.getItem(THEME_KEY) ?? undefined;
  } catch {
    // Storage blocked: the other site uses its default theme.
  }
  if (value === "light" || value === "dark" || value === "system") url.searchParams.set("theme", value);
  return url.toString();
}

/** The demo's start page on the demo subdomain (skipping its root redirect), with the theme. */
export function externalDemoUrl(theme?: string) {
  return withTheme(new URL("/demo", DEMO_URL), theme);
}

/** The real site, for leaving the demo subdomain (sign up, exit), with the theme. */
export function mainSiteUrl(path: string) {
  return withTheme(new URL(path, import.meta.env.VITE_APP_URL || window.location.origin));
}

/** The same SPA serves the demo on its own subdomain (demo.ohshifts.com). */
export function isDemoHost() {
  return typeof window !== "undefined" && window.location.hostname.startsWith("demo.");
}

export function isDemoProfile(profile: { companies?: unknown } | null | undefined) {
  const company = profile?.companies;
  return Boolean(company && typeof company === "object" && "is_demo" in company && company.is_demo === true);
}
