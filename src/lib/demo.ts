/** Where "Try the live demo" goes: demo.ohshifts.com in production, `/demo` locally. */
export const DEMO_URL: string = import.meta.env.VITE_DEMO_URL || "/demo";

/** The demo is on another origin (demo.ohshifts.com), so reaching it is a full page load. */
export const DEMO_IS_EXTERNAL = /^https?:\/\//.test(DEMO_URL);

/** The real site, for leaving the demo subdomain (sign up, exit). */
export function mainSiteUrl(path: string) {
  return new URL(path, import.meta.env.VITE_APP_URL || window.location.origin).toString();
}

/** The same SPA serves the demo on its own subdomain (demo.ohshifts.com). */
export function isDemoHost() {
  return typeof window !== "undefined" && window.location.hostname.startsWith("demo.");
}

export function isDemoProfile(profile: { companies?: unknown } | null | undefined) {
  const company = profile?.companies;
  return Boolean(company && typeof company === "object" && "is_demo" in company && company.is_demo === true);
}
