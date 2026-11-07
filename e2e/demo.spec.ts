import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:3099";
const company = { id: "demo-co", name: "Brew & Bloom Café", morning_start: "07:00", morning_end: "15:00", evening_start: "15:00", evening_end: "23:00", is_demo: true };
const personas = {
  owner: { id: "alex", full_name: "Alex Morgan", role: "owner" },
  manager: { id: "priya", full_name: "Priya Patel", role: "manager" },
  employee: { id: "sam", full_name: "Sam Rivera", role: "employee" },
} as const;
type Role = keyof typeof personas;
const session = (role: Role, companies: object = company) => {
  const p = personas[role];
  const email = `${p.id}@demo.invalid`;
  return { accessToken: `token-${role}`, user: { id: p.id, email, profile: { ...p, email, company_id: "demo-co", designation: null, avatar_url: null, created_at: new Date().toISOString(), companies } } };
};

/** Mocks the API; returns the requests the demo endpoints received. */
async function mockApi(page: Page, { startFails = false, isDemo = true, dashboardDelayMs = 0 } = {}) {
  const calls: { start: unknown[]; switch: unknown[]; publish: number } = { start: [], switch: [], publish: 0 };
  const now = Date.now();
  const draft = { id: "draft-1", company_id: "demo-co", employee_id: "sam", title: "Morning", start_time: new Date(now + 3_600_000).toISOString(), end_time: new Date(now + 4 * 3_600_000).toISOString(), status: "draft", published_at: null, created_at: new Date(now).toISOString(), users: { full_name: "Sam Rivera" } };
  let failStart = startFails;
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const token = request.headers().authorization?.replace("Bearer ", "");
    const role = (Object.keys(personas) as Role[]).find((r) => token === `token-${r}`) ?? "owner";
    let body: object = {};
    let status = 200;
    if (path === "/demo/start") {
      calls.start.push(request.postDataJSON());
      if (failStart) { failStart = false; status = 503; body = { error: "The demo is very busy right now. Try again in a few minutes." }; }
      else { status = 201; body = session("owner"); }
    } else if (path === "/demo/switch") {
      const next = request.postDataJSON().role as Role;
      calls.switch.push(next);
      body = session(next);
    } else if (path === "/auth/me") body = { user: token ? session(role, { ...company, is_demo: isDemo }).user : null };
    else if (path === "/dashboard/company" && role === "employee") { status = 403; body = { error: "Employees use employee dashboard" }; }
    else if (path === "/dashboard/company") {
      if (dashboardDelayMs) await new Promise((resolve) => setTimeout(resolve, dashboardDelayMs));
      body = { profile: session(role).user.profile, employees: [{ id: "sam", full_name: "Sam Rivera", email: "sam@demo.invalid", designation: "Barista", role: "employee" }], shifts: [draft], myShifts: [] }; }
    else if (path === "/dashboard/employee") body = { profile: session(role).user.profile, shifts: [], companyShifts: [] };
    else if (path === "/shifts/company") body = { shifts: [draft] };
    else if (path === "/company/schedule/publish") { calls.publish++; body = { message: "Published 1 shift(s)", publishedCount: 1, weekStart: "2026-11-02" }; }
    else if (path === "/time-off/company" || path === "/time-entries/company") body = { pending: [], recent: [] };
    else if (path === "/company/activity") body = { activity: [] };
    else if (path === "/messages/conversations") body = { conversations: [] };
    else if (path === "/announcements") body = { announcements: [] };
    else if (path === "/shifts/mine") body = { shifts: [] };
    else if (path === "/inbox/unread") body = { announcements: 0, messages: 0, total: 0 };
    else if (path === "/time-entries/active") body = { entry: null };
    else if (path === "/time-entries/mine") body = { entries: [] };
    await route.fulfill({ status, json: body, headers: { "Access-Control-Allow-Origin": "*" } });
  });
  return calls;
}

const tour = (page: Page) => page.getByRole("complementary", { name: "Product tour" });

for (const isDemo of [true, false]) {
  test(`mobile account logout clears a same-origin ${isDemo ? "demo" : "regular"} session`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const calls = await mockApi(page, { isDemo });
    if (isDemo) {
      await page.goto("/demo");
      await page.getByRole("button", { name: "Hide the tour", exact: true }).click();
    } else {
      await page.addInitScript(() => {
        if (location.pathname === "/company/dashboard") localStorage.setItem("ohshift_access_token", "token-owner");
      });
      await page.goto("/company/dashboard");
    }
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name: /Alex Morgan/ }).click();
    await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Try the live demo" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("ohshift_access_token"))).toBeNull();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
    await page.reload();
    await expect(page.getByRole("link", { name: "Try the live demo" })).toBeVisible();
    expect(calls.start).toHaveLength(isDemo ? 1 : 0);
  });
}

test("the hero's live demo button creates a sandbox and opens the tour", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/");
  await page.evaluate(() => { (window as unknown as { samePage: boolean }).samePage = true; });
  await page.getByRole("link", { name: "Try the live demo" }).click();

  await expect(page).toHaveURL(/\/company\/dashboard$/);
  // In-app navigation: a full reload would flash a blank page first.
  expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(true);
  expect(calls.start).toHaveLength(1);
  expect(calls.start[0]).toMatchObject({ timezone: expect.any(String) });
  expect(await page.evaluate(() => localStorage.getItem("ohshift_access_token"))).toBe("token-owner");

  await expect(page.getByTestId("demo-bar")).toContainText("Live demo");
  await expect(tour(page).getByTestId("current-quest")).toContainText("Assign a shift");
});

test("the loading screen stays up until the Overview's data has loaded", async ({ page }) => {
  await mockApi(page, { dashboardDelayMs: 1500 });
  await page.goto("/demo");
  // Just the spinner: 12 animated spokes and no text to try to read.
  const spinner = page.getByRole("status", { name: "Loading the demo" });
  await expect(spinner).toBeVisible();
  await expect(spinner.locator("line")).toHaveCount(12);
  expect(await spinner.locator("line").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("spinner-fade");
  expect((await page.locator("#root").innerText()).trim()).toBe("");
  await page.waitForTimeout(700);
  // Still the loading screen: no half-loaded dashboard, spinner or tour yet.
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByTestId("demo-bar")).toHaveCount(0);

  await expect(page).toHaveURL(/\/company\/dashboard$/);
  // Content is there the moment the dashboard shows (the data was prefetched).
  await expect(page.locator('[data-tour="publish"]')).toBeVisible({ timeout: 500 });
  await expect(tour(page)).toBeVisible();
});

test("doing the real action ticks the quest, and progress survives a reload", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/demo");
  await expect(tour(page).getByTestId("current-quest")).toContainText("Assign a shift");

  await tour(page).getByRole("button", { name: "Skip" }).click();
  await expect(tour(page).getByTestId("current-quest")).toContainText("Publish next week");

  await page.locator('[data-tour="publish"]').click();
  expect(calls.publish).toBe(1);
  // Completion shows in the panel only: no toast.
  await expect(page.getByText(/Quest complete/)).toHaveCount(0);
  await expect(tour(page).getByTestId("current-quest")).toContainText("Add a teammate");
  await expect(page.getByRole("button", { name: /Tour 2\/\d+/ })).toBeVisible();

  await page.reload();
  await expect(tour(page).getByTestId("current-quest")).toContainText("Add a teammate");
  // Visiting /demo again resumes the same sandbox instead of creating another.
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/company\/dashboard$/);
  expect(calls.start).toHaveLength(1);
});

test("the role switcher shows the employee side and back", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/demo");
  await expect(page.getByTestId("demo-bar")).toBeVisible();

  await page.getByRole("group", { name: "View the demo as" }).getByRole("button", { name: "Employee" }).click();
  // The page shows its loading spinner for a deliberate moment, then the new view.
  await expect(page.getByRole("status", { name: "Switching view" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("status", { name: "Switching view" })).toHaveCount(0);
  expect(calls.switch).toEqual(["employee"]);
  await expect(page.getByRole("button", { name: /Tour 1\/\d+/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Employee" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Manager" }).click();
  await expect(page).toHaveURL(/\/company\/dashboard$/);
  expect(calls.switch).toEqual(["employee", "manager"]);
});

test("'Take me there' switches to a role that can do the quest", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/demo");
  await tour(page).getByRole("button", { name: /All steps/ }).click();
  await tour(page).getByRole("button", { name: "Clock in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/hours$/);
  expect(calls.switch).toEqual(["employee"]);
});

test("a failed start explains why and can be retried", async ({ page }) => {
  const calls = await mockApi(page, { startFails: true });
  await page.goto("/demo");
  await expect(page.getByRole("alert")).toContainText("very busy");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/company\/dashboard$/);
  expect(calls.start).toHaveLength(2);
});

test("real (non-demo) sessions never show the demo bar or tour", async ({ page }) => {
  await mockApi(page, { isDemo: false });
  await page.addInitScript(() => localStorage.setItem("ohshift_access_token", "token-owner"));
  await page.goto("/company/dashboard");
  await expect(page.locator('[data-tour="publish"]')).toBeVisible();
  await expect(page.getByTestId("demo-bar")).toHaveCount(0);
  await expect(tour(page)).toHaveCount(0);
});
