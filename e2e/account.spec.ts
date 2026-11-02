import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
const user = { id: "browser-worker", email: "browser@test.invalid", profile: { id: "browser-worker", email: "browser@test.invalid", full_name: "Browser Worker", role: "employee", company_id: "browser-company", companies: { name: "Browser Company", morning_start: "08:00", morning_end: "16:00", evening_start: "16:00", evening_end: "00:00" } } };
async function mockApi(page: Page, loginOk = false, role = "employee") {
  const principal = { ...user, profile: { ...user.profile, role } };
  await page.route("http://127.0.0.1:3099/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: object = {}, status = 200;
    if (path === "/auth/login") { body = loginOk ? { user: principal, accessToken: "browser-test-token" } : { error: "Invalid credentials" }; status = loginOk ? 200 : 401; }
    else if (path === "/auth/me") body = { user: route.request().headers().authorization ? principal : null };
    else if (path === "/auth/reset-password") body = { message: "If an account exists for that email, a password link will arrive shortly." };
    else if (path === "/auth/set-password") body = { message: "Password saved" };
    else if (path === "/dashboard/employee") body = { profile: principal.profile, shifts: [], companyShifts: [] };
    else if (path === "/dashboard/company") body = { profile: principal.profile, employees: [], shifts: [], myShifts: [] };
    else if (path === "/time-off/company" || path === "/time-entries/company") body = { pending: [], recent: [] };
    else if (path === "/company/activity") body = { activity: [] };
    else if (path === "/messages/conversations") body = { conversations: [] };
    else if (path === "/announcements") body = { announcements: [] };
    else if (path === "/shifts/company") body = { shifts: [] };
    else if (path === "/shifts/mine") body = { shifts: [] };
    else if (path === "/inbox/unread") body = { announcements: 0, messages: 0, total: 0 };
    else if (path === "/time-entries/active") body = { entry: null };
    else if (path === "/time-entries/mine") body = { entries: [] };
    else if (path === "/ping") body = { ok: true };
    await route.fulfill({ status, json: body, headers: { "Access-Control-Allow-Origin": "*" } });
  });
}
test("incorrect login displays an error without storing a session", async ({ page }) => {
  await mockApi(page); await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("browser@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Login failed", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ohshift_access_token"))).toBeNull();
});
test("successful login opens the employee dashboard", async ({ page }) => {
  await mockApi(page, true); await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("browser@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Your schedule", { exact: true })).toBeVisible();
});
test("revoked sessions clear cached authentication and leave private pages", async ({ page }) => {
  await mockApi(page, true); await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("browser@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.route("http://127.0.0.1:3099/dashboard/employee", route => route.fulfill({ status: 401, json: { error: "Unauthorized" } }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ohshift_access_token")), { timeout: 15_000 }).toBeNull();
  await expect(page).toHaveURL("http://127.0.0.1:4173/");
});
test("account link hides its token and requires matching passwords before submission", async ({ page }) => {
  test.skip(!existsSync("src/routes/set-password.tsx"), "Requires the Resend/account-security branch");
  await mockApi(page);
  let submissions = 0;
  await page.route("http://127.0.0.1:3099/auth/set-password", async route => { submissions++; await route.fulfill({ json: { message: "Password saved" } }); });
  const token = "a".repeat(64);
  await page.goto(`/set-password#${token}`);
  await expect(page).toHaveURL(/\/set-password$/);
  await page.getByLabel("New password", { exact: true }).fill("new-browser-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("different-password-123");
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords must match."); expect(submissions).toBe(0);
  await page.getByLabel("Confirm password", { exact: true }).fill("new-browser-password-123");
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password saved" })).toBeVisible(); expect(submissions).toBe(1);
});

test("week navigation fetches the selected week for employees and managers", async ({ page }) => {
  test.skip(!existsSync("src/lib/messages.ts"), "Requires bounded-query branch");
  for (const role of ["employee", "manager"]) {
    await mockApi(page, true, role);
    await page.addInitScript(() => localStorage.setItem("ohshift_access_token", "browser-test-token"));
    const ranges: string[] = [];
    const endpoint = role === "employee" ? "mine" : "company";
    await page.route(`http://127.0.0.1:3099/shifts/${endpoint}**`, async route => {
      ranges.push(new URL(route.request().url()).searchParams.get("from") ?? "");
      await route.fulfill({ json: { shifts: [] } });
    });
    await page.goto(role === "employee" ? "/dashboard" : "/company/dashboard");
    await expect.poll(() => ranges.length).toBeGreaterThan(0);
    const initial = ranges[0];
    await page.getByRole("button", { name: "Previous week", exact: true }).click();
    await expect.poll(() => ranges.at(-1)).not.toBe(initial);
    const days = (new Date(initial!).getTime() - new Date(ranges.at(-1)!).getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(6); expect(days).toBeLessThan(8);
    await page.unroute(`http://127.0.0.1:3099/shifts/${endpoint}**`);
  }
});
test("manager invitations confirm email delivery without displaying credentials", async ({ page }) => {
  test.skip(!existsSync("src/routes/set-password.tsx"), "Requires Resend/account-security branch");
  await mockApi(page, true, "manager");
  await page.addInitScript(() => localStorage.setItem("ohshift_access_token", "browser-test-token"));
  const invitations: unknown[] = [];
  await page.route("http://127.0.0.1:3099/employees/invite", async route => {
    invitations.push(route.request().postDataJSON());
    await route.fulfill({ json: { invites: [{ fullName: "New teammate", email: "new@test.invalid" }], message: "Invitation sent" } });
  });
  await page.goto("/company/dashboard");
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name", { exact: true }).fill("New teammate");
  await dialog.getByLabel("Email", { exact: true }).fill("new@test.invalid");
  await dialog.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText("Invitation sent", { exact: true })).toBeVisible();
  expect(invitations).toEqual([{ invites: [{ fullName: "New teammate", email: "new@test.invalid", designation: "" }] }]);
  await expect(page.getByText(/Share these invite codes/)).toHaveCount(0);
});
test("message history loads older pages while retaining the latest messages", async ({ page }) => {
  test.skip(!existsSync("src/lib/messages.ts"), "Requires conversation-history branch");
  await mockApi(page, true);
  await page.addInitScript(() => localStorage.setItem("ohshift_access_token", "browser-test-token"));
  const message = (id: string, body: string) => ({ id, body, sender_id: "other-worker", created_at: `2035-01-01T0${id}:00:00Z` });
  await page.route("http://127.0.0.1:3099/messages/conversations", route => route.fulfill({ json: { conversations: [{ id: "browser-thread", updated_at: "2035-01-01T09:00:00Z", other: { id: "other-worker", full_name: "Other worker", role: "manager", avatar_url: null }, last_message: null, unread_count: 0 }] } }));
  await page.route("http://127.0.0.1:3099/messages/conversations/browser-thread**", route => {
    const old = new URL(route.request().url()).searchParams.has("before");
    return route.fulfill({ json: old ? { messages: [message("1", "Older history message")], next_cursor: null } : { messages: [message("2", "Newest message")], next_cursor: "test-cursor" } });
  });
  await page.goto("/dashboard/inbox");
  await page.getByRole("button", { name: "Messages", exact: true }).click();
  await page.getByRole("button", { name: /Other worker/ }).click();
  await expect(page.getByText("Newest message", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load older messages", exact: true }).click();
  await expect(page.getByText("Older history message", { exact: true })).toBeVisible();
  await expect(page.getByText("Newest message", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load older messages", exact: true })).toHaveCount(0);
});
