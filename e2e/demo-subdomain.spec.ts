import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The production layout: ohshifts.com and demo.ohshifts.com are different
// origins (separate storage). Both are served by the second dev server.
const MAIN = "http://localhost:4175";
const DEMO = "http://demo.localhost:4175";
test.use({ launchOptions: { args: ["--host-resolver-rules=MAP demo.localhost 127.0.0.1, MAP localhost 127.0.0.1"] } });

const company = { id: "demo-co", name: "Brew & Bloom Café", morning_start: "07:00", morning_end: "15:00", evening_start: "15:00", evening_end: "23:00", is_demo: true };
const profile = { id: "alex", full_name: "Alex Morgan", email: "alex@demo.invalid", role: "owner", company_id: "demo-co", designation: null, avatar_url: null, created_at: new Date().toISOString(), companies: company };
const session = { accessToken: "token-owner", user: { id: "alex", email: profile.email, profile } };

async function mockApi(page: Page) {
  await page.route("http://127.0.0.1:3099/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const authed = Boolean(route.request().headers().authorization);
    let body: object = {};
    let status = 200;
    if (path === "/demo/start") { status = 201; body = session; }
    else if (path === "/auth/me") body = { user: authed ? session.user : null };
    else if (path === "/dashboard/company") body = { profile, employees: [], shifts: [], myShifts: [] };
    else if (path === "/shifts/company") body = { shifts: [] };
    else if (path === "/time-off/company" || path === "/time-entries/company") body = { pending: [], recent: [] };
    else if (path === "/company/activity") body = { activity: [] };
    else if (path === "/inbox/unread") body = { announcements: 0, messages: 0, total: 0 };
    await route.fulfill({ status, json: body, headers: { "Access-Control-Allow-Origin": "*" } });
  });
}

/** Records the page's theme on every frame, across full page loads. */
async function watchTheme(page: Page) {
  const seen: string[] = [];
  await page.exposeFunction("reportTheme", (entry: string) => { seen.push(entry); });
  await page.addInitScript(() => {
    let last = "";
    const tick = () => {
      const entry = `${location.host} ${document.documentElement.classList.contains("dark") ? "dark" : "light"}`;
      if (entry !== last) { last = entry; (window as unknown as { reportTheme(e: string): void }).reportTheme(entry); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return seen;
}

test("the demo subdomain keeps the visitor's theme in and out, without a flash", async ({ page }) => {
  await mockApi(page);
  const seen = await watchTheme(page);
  await page.goto(`${MAIN}/`);
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();

  await page.getByRole("link", { name: "Try the live demo" }).click();
  await expect(page).toHaveURL(`${DEMO}/company/dashboard`);
  // Straight to /demo (no root redirect), and ?theme= is stripped and saved on the demo origin.
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
  // Never painted dark on the way in.
  expect(seen.filter((entry) => entry.startsWith("demo.")).every((entry) => entry.endsWith("light"))).toBe(true);

  // A theme chosen in the demo comes back to the main site on exit.
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  seen.length = 0;
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(page).toHaveURL(`${MAIN}/`);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  expect(seen.filter((entry) => entry.startsWith("localhost")).every((entry) => entry.endsWith("dark"))).toBe(true);
});

test("a carried ?theme= is applied and removed from the address bar", async ({ page }) => {
  await mockApi(page);
  await page.goto(`${MAIN}/?theme=light`);
  await expect(page).toHaveURL(`${MAIN}/`);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  // Anything else is ignored.
  await page.goto(`${MAIN}/?theme=neon`);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
});

// The dev server sends no CSP, so serve the real index.html and theme script
// under the real production policy from public/_headers.
test("the theme is applied under the production content security policy", async ({ page }) => {
  const csp = readFileSync("public/_headers", "utf8").match(/Content-Security-Policy: (.+)/)![1]!;
  const violations: string[] = [];
  page.on("console", (message) => { if (/Content Security Policy/.test(message.text())) violations.push(message.text()); });
  await page.route("http://csp.test/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/theme-init.js") await route.fulfill({ contentType: "text/javascript", body: readFileSync("public/theme-init.js", "utf8") });
    else if (pathname === "/demo") await route.fulfill({ contentType: "text/html", headers: { "Content-Security-Policy": csp }, body: readFileSync("index.html", "utf8") });
    else await route.abort();
  });
  await page.goto("http://csp.test/demo?theme=light");
  expect(violations).toEqual([]);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
  await expect(page).toHaveURL("http://csp.test/demo");
});
