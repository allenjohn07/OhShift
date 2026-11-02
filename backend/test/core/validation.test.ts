import { testDb, schema } from "../ai/harness";
import { expect, test } from "bun:test";
const { default: app } = await import("../../src/index");
const { createAccessToken } = await import("../../src/lib/session");
const { dateOnly, instant, timezone, httpsUrl } = await import("../../src/lib/validation");
async function ownerToken() {
  const [u] = await testDb.insert(schema.users).values({ fullName: "Validation owner", email: `${crypto.randomUUID()}@validation.test`, role: "owner" }).returning();
  const [c] = await testDb.insert(schema.companies).values({ name: "Validation", ownerId: u!.id }).returning();
  const { eq } = await import("drizzle-orm");
  const [owner] = await testDb.update(schema.users).set({ companyId: c!.id }).where(eq(schema.users.id, u!.id)).returning();
  return createAccessToken(owner!);
}
test("malformed field types return 400 instead of exceptions or coercion", async () => {
  const token = await ownerToken();
  const cases: [string, string, object][] = [
    ["/auth/login", "POST", { email: 123, password: {} }],
    ["/auth/register-company", "POST", { companyName: "X", name: "Y", email: "valid@test.invalid", password: "short" }],
    ["/employees/invite", "POST", { invites: [{ email: {}, fullName: "X" }] }],
    ["/shifts", "POST", { employeeId: [], title: "X", startTime: "2035-02-31T09:00:00Z", endTime: "2035-03-03T09:00:00Z" }],
    ["/shifts", "POST", { timezone: "Invalid/Timezone" }],
    ["/availability", "PUT", { days: Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, is_available: "false", start_time: "09:00", end_time: "17:00" })) }],
    ["/company", "PUT", { morning_start: "29:00" }],
    ["/company", "PUT", {}],
    ["/employees", "PUT", { employeeId: "missing" }],
    ["/company/schedule/publish", "POST", { weekStart: "2035-01-08", from: "2035-01-08T00:00:00Z" }],
    ["/time-off", "POST", { type: "vacation", start_date: "2035-02-31", end_date: "2035-03-01" }],
    ["/auth/update-avatar", "POST", { avatarUrl: "javascript:alert(1)" }],
  ];
  for (const [path, method, body] of cases) {
    const response = await app.request(path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect(response.status, path).toBe(400);
  }
});
test("request size and invalid query parameters are bounded", async () => {
  const token = await ownerToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  expect((await app.request("/auth/login", { method: "POST", headers, body: JSON.stringify({ email: "x@test.invalid", password: "x".repeat(70_000) }) })).status).toBe(413);
  expect((await app.request("/shifts/eligible?start=bad&end=bad", { headers })).status).toBe(400);
  for (const body of [[], null, "string", { title: { nested: true } }]) {
    expect((await app.request("/announcements", { method: "POST", headers, body: JSON.stringify(body) })).status).toBe(400);
  }
});
test("calendar validation rejects rolled dates and accepts leap years and IANA zones", () => {
  expect(dateOnly("2035-02-31")).toBe(false); expect(dateOnly("2036-02-29")).toBe(true);
  expect(instant("2035-02-31T09:00:00Z")).toBe(false); expect(instant("2036-02-29T09:00:00-07:00")).toBe(true);
  expect(timezone("America/Edmonton")).toBe(true); expect(timezone("not-a-zone")).toBe(false);
  expect(httpsUrl("https://images.example.invalid/avatar.png")).toBe(true); expect(httpsUrl("https://user:secret@example.invalid/a")).toBe(false);
});
