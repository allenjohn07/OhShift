import { schema, testDb } from "../ai/harness";
import { afterEach, beforeEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { and, eq, like, sql } from "drizzle-orm";

const { ApiError } = await import("../../src/lib/auth-guard");
const { createAccessToken } = await import("../../src/lib/session");
const { emailTransport } = await import("../../src/lib/email");
const { deleteExpiredDemoSandboxes } = await import("../../src/lib/demo/cleanup");
const { demoRoutes } = await import("../../src/routes/demo");
const { authRoutes } = await import("../../src/routes/auth");
const { employeesRoutes } = await import("../../src/routes/employees");
const { companyRoutes } = await import("../../src/routes/company");
const { shiftsRoutes } = await import("../../src/routes/shifts");
const { timeEntriesRoutes } = await import("../../src/routes/time-entries");
const { messagesRoutes } = await import("../../src/routes/messages");
const { aiRoutes } = await import("../../src/routes/ai");

const app = new Hono().onError((e, c) => {
  if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400);
  throw e;
}).route("/demo", demoRoutes).route("/auth", authRoutes).route("/employees", employeesRoutes)
  .route("/company", companyRoutes).route("/shifts", shiftsRoutes).route("/time-entries", timeEntriesRoutes)
  .route("/messages", messagesRoutes).route("/ai", aiRoutes);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
let ipCounter = 0;
async function call(path: string, { token, method = "GET", body, ip }: { token?: string; method?: string; body?: object; ip?: string } = {}) {
  const pending: Promise<unknown>[] = [];
  const response = await app.request(path, {
    method,
    headers: { "content-type": "application/json", "CF-Connecting-IP": ip ?? `10.0.0.${++ipCounter}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }, undefined, { waitUntil: (p: Promise<unknown>) => { pending.push(p); }, passThroughOnException() {}, props: {} });
  await Promise.all(pending);
  return { status: response.status, json: (await response.json()) as Json };
}

async function startDemo() {
  const res = await call("/demo/start", { method: "POST", body: { timezone: "America/New_York" } });
  expect(res.status).toBe(201);
  return { token: res.json.accessToken as string, companyId: res.json.user.profile.company_id as string, profile: res.json.user.profile };
}
const switchTo = (token: string, role: string) => call("/demo/switch", { token, method: "POST", body: { role } });

let mails: unknown[];
let fetchSpy: ReturnType<typeof spyOn<typeof emailTransport, "fetch">>;
beforeEach(() => {
  mails = [];
  fetchSpy = spyOn(emailTransport, "fetch").mockImplementation(async (_input, init) => {
    mails.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "test" });
  });
});
afterEach(() => fetchSpy.mockRestore());

test("starting a demo seeds a private company and signs the visitor in as its owner", async () => {
  const { token, companyId, profile } = await startDemo();
  expect(profile.role).toBe("owner");
  expect(profile.companies.is_demo).toBe(true);

  const me = await call("/auth/me", { token });
  expect(me.json.user.profile.company_id).toBe(companyId);

  const team = await testDb.select().from(schema.users).where(eq(schema.users.companyId, companyId));
  expect(team.length).toBe(10);
  expect(team.every(u => u.passwordHash === null && u.email.endsWith(".demo.invalid"))).toBe(true);

  const shifts = await testDb.select().from(schema.shifts).where(eq(schema.shifts.companyId, companyId));
  expect(shifts.some(s => s.status === "draft")).toBe(true);
  expect(shifts.some(s => s.status === "published")).toBe(true);
  const pendingTimeOff = await testDb.select().from(schema.timeOffRequests).where(and(eq(schema.timeOffRequests.companyId, companyId), eq(schema.timeOffRequests.status, "pending")));
  expect(pendingTimeOff.length).toBeGreaterThan(0);
  const pendingEntries = await testDb.select().from(schema.timeEntries).where(and(eq(schema.timeEntries.companyId, companyId), eq(schema.timeEntries.status, "pending")));
  expect(pendingEntries.length).toBeGreaterThan(0);
  expect(mails).toHaveLength(0);
});

test("seeding works in any time zone, including half-hour offsets", async () => {
  for (const timezone of ["Asia/Kolkata", "Pacific/Chatham", "UTC"]) {
    expect((await call("/demo/start", { method: "POST", body: { timezone } })).status).toBe(201);
  }
  expect((await call("/demo/start", { method: "POST", body: { timezone: "Not/AZone" } })).status).toBe(400);
});

test("the role switcher signs in as each persona, and the employee is on shift now", async () => {
  const { token, companyId } = await startDemo();
  const manager = await switchTo(token, "manager");
  expect(manager.status).toBe(200);
  expect(manager.json.user.profile).toMatchObject({ role: "manager", company_id: companyId });

  const employee = await switchTo(manager.json.accessToken, "employee");
  expect(employee.json.user.profile).toMatchObject({ role: "employee", company_id: companyId });
  const now = Date.now();
  const mine = await call(`/shifts/mine?from=${new Date(now - 86_400_000).toISOString()}&to=${new Date(now + 86_400_000).toISOString()}`, { token: employee.json.accessToken });
  const current = mine.json.shifts.find((s: Json) => new Date(s.start_time).getTime() <= now && new Date(s.end_time).getTime() > now);
  expect(current).toBeDefined();
  const clockIn = await call("/time-entries/clock-in", { token: employee.json.accessToken, method: "POST", body: { shift_id: current.id } });
  expect(clockIn.status).toBe(200);

  expect((await switchTo(employee.json.accessToken, "owner")).json.user.profile.role).toBe("owner");
  expect((await switchTo(token, "superuser")).status).toBe(400);
});

test("switching falls back to another member when the persona's role changed", async () => {
  const { token, companyId } = await startDemo();
  // Demote both managers: nobody left to switch to.
  await testDb.update(schema.users).set({ role: "employee" }).where(and(eq(schema.users.companyId, companyId), eq(schema.users.role, "manager")));
  expect((await switchTo(token, "manager")).status).toBe(409);
  const [promoted] = await testDb.update(schema.users).set({ role: "manager" }).where(and(eq(schema.users.companyId, companyId), like(schema.users.email, "grace.kim@%"))).returning();
  const res = await switchTo(token, "manager");
  expect(res.json.user.id).toBe(promoted!.id);
});

test("sandboxes are isolated from each other and from real companies", async () => {
  const a = await startDemo();
  const b = await startDemo();
  const bIds = new Set((await testDb.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.companyId, b.companyId))).map(r => r.id));

  const directory = await call("/messages/directory", { token: a.token });
  expect(directory.status).toBe(200);
  expect(directory.json.members.length).toBeGreaterThan(0);
  expect(directory.json.members.some((m: Json) => bIds.has(m.id))).toBe(false);

  const schedule = await call(`/shifts/company?from=${new Date(Date.now() - 14 * 86_400_000).toISOString()}&to=${new Date(Date.now() + 14 * 86_400_000).toISOString()}`, { token: a.token });
  expect(schedule.json.shifts.length).toBeGreaterThan(0);
  expect(schedule.json.shifts.every((s: Json) => s.company_id === a.companyId)).toBe(true);

  for (const role of ["owner", "manager", "employee"]) {
    expect((await switchTo(a.token, role)).json.user.profile.company_id).toBe(a.companyId);
  }
});

test("only demo sessions can use the role switcher", async () => {
  const [owner] = await testDb.insert(schema.users).values({ fullName: "Real owner", email: `${crypto.randomUUID()}@real.test`, passwordHash: "test-only", role: "owner" }).returning();
  const [company] = await testDb.insert(schema.companies).values({ name: "Real Co", ownerId: owner!.id }).returning();
  const [linked] = await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, owner!.id)).returning();
  const token = await createAccessToken(linked!);
  expect((await switchTo(token, "employee")).status).toBe(403);
  expect((await switchTo("not-a-token", "employee")).status).toBe(401);
  expect((await call("/auth/me", { token })).json.user.profile.companies.is_demo).toBe(false);
});

test("demo invites add the teammate without sending email or storing the typed address", async () => {
  const { token, companyId } = await startDemo();
  const res = await call("/employees/invite", { token, method: "POST", body: { invites: [{ email: "Real.Person@gmail.com", fullName: "Real Person", designation: "Barista" }] } });
  expect(res.status).toBe(200);
  expect(res.json.demo).toBe(true);
  expect(mails).toHaveLength(0);
  const [added] = await testDb.select().from(schema.users).where(and(eq(schema.users.companyId, companyId), eq(schema.users.fullName, "Real Person")));
  expect(added!.email).toMatch(/^real\.person\.[0-9a-f]{4}@[0-9a-f]{12}\.demo\.invalid$/);
  expect((await testDb.select().from(schema.users).where(sql`lower(${schema.users.email}) = 'real.person@gmail.com'`)).length).toBe(0);
  expect((await testDb.select().from(schema.accountTokens).where(eq(schema.accountTokens.userId, added!.id))).length).toBe(0);

  const many = Array.from({ length: 20 }, (_, i) => ({ email: `crew${i}@example.com`, fullName: `Crew ${i}` }));
  expect((await call("/employees/invite", { token, method: "POST", body: { invites: many } })).status).toBe(200);
  expect((await call("/employees/invite", { token, method: "POST", body: { invites: [{ email: "nope", fullName: "X" }] } })).status).toBe(400);
});

test("publishing in a demo enqueues no schedule emails", async () => {
  const { token, companyId } = await startDemo();
  const drafts = await testDb.select().from(schema.shifts).where(and(eq(schema.shifts.companyId, companyId), eq(schema.shifts.status, "draft")));
  const from = new Date(Math.min(...drafts.map(s => s.startTime.getTime())));
  const to = new Date(Math.max(...drafts.map(s => s.startTime.getTime())) + 1);
  const res = await call("/company/schedule/publish", { token, method: "POST", body: { weekStart: from.toISOString().slice(0, 10), from: from.toISOString(), to: to.toISOString() } });
  expect(res.status).toBe(200);
  expect(res.json.publishedCount).toBe(drafts.length);
  expect((await testDb.select().from(schema.emailJobs).where(eq(schema.emailJobs.companyId, companyId))).length).toBe(0);
});

test("account settings are refused for demo users", async () => {
  const { token } = await startDemo();
  expect((await call("/auth/change-password", { token, method: "POST", body: { currentPassword: "whatever-123", newPassword: "another-password-123" } })).status).toBe(403);
  expect((await call("/auth/update-avatar", { token, method: "POST", body: { avatarUrl: "https://img.test/a.png" } })).status).toBe(403);
  const [persona] = await testDb.select().from(schema.users).where(like(schema.users.email, "alex.morgan@%")).limit(1);
  expect((await call("/auth/reset-password", { method: "POST", body: { email: persona!.email } })).status).toBe(200);
  expect(mails).toHaveLength(0);
});

test("each sandbox gets five assistant questions in total, across roles", async () => {
  const { token } = await startDemo();
  const employee = (await switchTo(token, "employee")).json.accessToken;
  const ask = (t: string) => call("/ai/ask", { token: t, method: "POST", body: { prompt: "When do I work next?", timezone: "UTC" } });
  for (let i = 0; i < 5; i++) expect((await ask(i % 2 ? employee : token)).status).toBe(200);
  const refused = await ask(employee);
  expect(refused.status).toBe(429);
  expect(refused.json.error).toContain("5 assistant questions");
  // Another sandbox has its own allowance.
  expect((await ask((await startDemo()).token)).status).toBe(200);
});

test("starting demos is rate-limited per IP", async () => {
  // The limit counts per calendar minute: if the 11 requests straddled a
  // minute boundary, the 11th would land in a fresh bucket and pass. Freeze
  // the clock just after the current minute starts.
  setSystemTime(new Date(Math.floor(Date.now() / 60_000) * 60_000 + 1_000));
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await call("/demo/start", { method: "POST", body: {}, ip: "203.0.113.9" })).status);
    expect(statuses.slice(0, 10).every(s => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  } finally {
    setSystemTime();
  }
});

test("cleanup deletes expired sandboxes only", async () => {
  const expired = await startDemo();
  const live = await startDemo();
  const [real] = await testDb.select({ id: schema.companies.id }).from(schema.companies).where(sql`${schema.companies.demoExpiresAt} IS NULL`).limit(1);
  const domain = (await testDb.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.companyId, expired.companyId)).limit(1))[0]!.email.split("@")[1]!;
  await call("/employees/invite", { token: expired.token, method: "POST", body: { invites: [{ email: "x@example.com", fullName: "Invitee" }] } });
  await testDb.update(schema.companies).set({ demoExpiresAt: new Date(Date.now() - 1000) }).where(eq(schema.companies.id, expired.companyId));

  expect(await deleteExpiredDemoSandboxes()).toBeGreaterThanOrEqual(1);

  expect((await testDb.select().from(schema.companies).where(eq(schema.companies.id, expired.companyId))).length).toBe(0);
  expect((await testDb.select().from(schema.users).where(like(schema.users.email, `%@${domain}`))).length).toBe(0);
  for (const table of [schema.shifts, schema.timeOffRequests, schema.timeEntries, schema.announcements, schema.conversations, schema.shiftLogs]) {
    expect((await testDb.select().from(table).where(eq(table.companyId, expired.companyId))).length).toBe(0);
  }
  expect((await call("/auth/me", { token: expired.token })).json.user).toBeNull();

  expect((await testDb.select().from(schema.companies).where(eq(schema.companies.id, live.companyId))).length).toBe(1);
  expect((await testDb.select().from(schema.users).where(eq(schema.users.companyId, live.companyId))).length).toBe(10);
  if (real) expect((await testDb.select().from(schema.companies).where(eq(schema.companies.id, real.id))).length).toBe(1);
  expect(await deleteExpiredDemoSandboxes()).toBe(0);
});
