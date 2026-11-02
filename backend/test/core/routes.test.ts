import { schema, testDb } from "../ai/harness";
import { beforeAll, expect, test } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";

const { ApiError } = await import("../../src/lib/auth-guard");
const { createAccessToken } = await import("../../src/lib/session");
const { authRoutes } = await import("../../src/routes/auth");
const { shiftsRoutes } = await import("../../src/routes/shifts");
const { employeesRoutes } = await import("../../src/routes/employees");
const { companyRoutes } = await import("../../src/routes/company");
const { timeOffRoutes } = await import("../../src/routes/time-off");
const { availabilityRoutes } = await import("../../src/routes/availability");
const { timeEntriesRoutes } = await import("../../src/routes/time-entries");
const { messagesRoutes } = await import("../../src/routes/messages");
const { announcementsRoutes } = await import("../../src/routes/announcements");

const app = new Hono().onError((e, c) => {
  if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400);
  throw e;
}).route("/auth", authRoutes).route("/shifts", shiftsRoutes).route("/employees", employeesRoutes)
  .route("/company", companyRoutes).route("/time-off", timeOffRoutes)
  .route("/availability", availabilityRoutes).route("/time-entries", timeEntriesRoutes)
  .route("/messages", messagesRoutes).route("/announcements", announcementsRoutes);

const people: Record<string, string> = {};
const tokens: Record<string, string> = {};
let companyId: string;
let otherCompanyId: string;
beforeAll(async () => {
  for (const [key, role] of [["owner", "owner"], ["manager", "manager"], ["employee", "employee"], ["other", "owner"]] as const) {
    const [u] = await testDb.insert(schema.users).values({ fullName: `Core ${key}`, email: `core-${key}@test.invalid`, passwordHash: "test-only", role }).returning();
    people[key] = u!.id;
  }
  const [a, b] = await testDb.insert(schema.companies).values([
    { name: "Core A", ownerId: people.owner! }, { name: "Core B", ownerId: people.other! },
  ]).returning();
  companyId = a!.id; otherCompanyId = b!.id;
  for (const key of Object.keys(people)) {
    const [u] = await testDb.update(schema.users).set({ companyId: key === "other" ? otherCompanyId : companyId }).where(eq(schema.users.id, people[key]!)).returning();
    tokens[key] = await createAccessToken(u!);
  }
});
type Payload = {
  accessToken: string;
  announcement: { id: string };
  announcements: { id: string; is_read: boolean }[];
  count: number;
  shift: { id: string; status: string };
  shifts: { id: string; status: string }[];
  request: { id: string; status: string };
  requests: { id: string; status: string }[];
  publishedCount: number;
  days: { start_time: string }[];
  conversation: { id: string };
  entry: { id: string; status: string };
};
async function request(path: string, actor = "employee", method = "GET", body?: object) {
  const pending: Promise<unknown>[] = [];
  const response = await app.request(path, { method, headers: { authorization: `Bearer ${tokens[actor] ?? "invalid"}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }, undefined, {
    waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
    passThroughOnException() {},
    props: {},
  });
  await Promise.all(pending);
  return response as Omit<Response, "json"> & { json(): Promise<Payload> };
}
const shiftBody = (start = "2035-01-08T09:00:00Z", end = "2035-01-08T12:00:00Z") => ({ employeeId: people.employee, title: "Core shift", startTime: start, endTime: end, timezone: "UTC" });

test("all core endpoints require a valid session", async () => {
  for (const path of ["/shifts/mine", "/availability", "/time-off", "/time-entries/mine", "/messages/directory", "/announcements"]) {
    expect((await request(path, "anonymous")).status).toBe(401);
  }
});
test("only owners assign roles; tenant and owner boundaries are enforced", async () => {
  const body = { employeeId: people.employee, role: "manager" };
  expect((await request("/employees", "manager", "PUT", body)).status).toBe(403);
  expect((await request("/employees", "employee", "PUT", body)).status).toBe(403);
  expect((await request("/employees", "other", "PUT", body)).status).toBe(400);
  expect((await request("/employees", "owner", "PUT", { ...body, employeeId: people.owner })).status).toBe(403);
  expect((await request("/employees", "owner", "PUT", { ...body, role: "owner" })).status).toBe(400);
  expect((await request("/employees", "owner", "PUT", body)).status).toBe(200);
  expect((await request("/employees", "owner", "PUT", { ...body, role: "employee" })).status).toBe(200);
});
test("draft creation, conflict rejection, publishing and employee visibility", async () => {
  expect((await request("/shifts", "employee", "POST", shiftBody())).status).toBe(403);
  expect((await request("/shifts", "other", "POST", shiftBody())).status).toBe(400);
  const created = await request("/shifts", "manager", "POST", shiftBody());
  expect(created.status).toBe(200);
  const { shift } = await created.json();
  expect(shift.status).toBe("draft");
  expect((await (await request("/shifts/mine")).json()).shifts).toHaveLength(0);
  expect((await request("/shifts", "manager", "POST", shiftBody())).status).toBe(409);
  expect((await request("/shifts", "manager", "POST", shiftBody("2035-01-08T11:00:00Z", "2035-01-08T13:00:00Z"))).status).toBe(409);
  expect((await request("/shifts", "manager", "POST", shiftBody("2035-01-08T12:00:00Z", "2035-01-08T13:00:00Z"))).status).toBe(200);
  expect((await request("/shifts", "manager", "POST", shiftBody("invalid"))).status).toBe(400);
  const publish = { weekStart: "2035-01-08" };
  expect((await request("/company/schedule/publish", "employee", "POST", publish)).status).toBe(403);
  expect((await (await request("/company/schedule/publish", "other", "POST", publish)).json()).publishedCount).toBe(0);
  expect((await (await request("/company/schedule/publish", "manager", "POST", publish)).json()).publishedCount).toBe(2);
  expect((await (await request("/shifts/mine")).json()).shifts).toHaveLength(2);
  expect((await (await request("/company/schedule/publish", "manager", "POST", publish)).json()).publishedCount).toBe(0);
  expect((await request(`/shifts?id=${shift.id}`, "other", "DELETE")).status).toBe(404);
});
test("bulk assignment detects conflicts within the same request", async () => {
  const body = shiftBody("2035-01-09T09:00:00Z", "2035-01-09T12:00:00Z");
  const response = await request("/shifts/bulk", "manager", "POST", { timezone: "UTC", shifts: [body, body] });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ created: 1, failed: 1 });
});
test("time off rejects overlap, scopes review and forbids self approval", async () => {
  const body = { type: "vacation", start_date: "2035-02-01", end_date: "2035-02-02" };
  const response = await request("/time-off", "employee", "POST", body);
  expect(response.status).toBe(200);
  const { request: row } = await response.json();
  expect((await request("/time-off", "employee", "POST", body)).status).toBe(400);
  expect((await request(`/time-off/${row.id}/review`, "other", "POST", { decision: "approved" })).status).toBe(404);
  expect((await request(`/time-off/${row.id}/review`, "employee", "POST", { decision: "approved" })).status).toBe(403);
  expect((await request(`/time-off/${row.id}/review`, "manager", "POST", { decision: "approved" })).status).toBe(200);
  expect((await request(`/time-off/${row.id}/cancel`, "employee", "POST")).status).toBe(400);
  expect((await (await request("/time-off")).json()).requests[0].status).toBe("approved");
  const own = await (await request("/time-off", "manager", "POST", body)).json();
  expect((await request(`/time-off/${own.request.id}/review`, "manager", "POST", { decision: "approved" })).status).toBe(403);
  expect((await request(`/time-off/${own.request.id}/cancel`, "manager", "POST")).status).toBe(200);
});
test("availability validates whole weeks and saves overnight windows for only the caller", async () => {
  const days = Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, is_available: true, start_time: "20:00", end_time: "04:00" }));
  expect((await request("/availability", "employee", "PUT", { days: days.slice(1) })).status).toBe(400);
  expect((await request("/availability", "employee", "PUT", { days: days.map(d => ({ ...d, day_of_week: 0 })) })).status).toBe(400);
  expect((await request("/availability", "employee", "PUT", { days: days.map(d => ({ ...d, end_time: "20:00" })) })).status).toBe(400);
  expect((await request("/availability", "employee", "PUT", { days })).status).toBe(200);
  expect((await (await request("/availability")).json()).days).toEqual(days);
  expect((await (await request("/availability", "other")).json()).days[0].start_time).not.toBe("20:00");
});
test("private messages are restricted to company members and participants", async () => {
  expect((await request("/messages/conversations", "employee", "POST", { recipient_id: people.other })).status).toBe(400);
  const created = await request("/messages/conversations", "employee", "POST", { recipient_id: people.manager });
  expect(created.status).toBe(200);
  const { conversation } = await created.json();
  const path = `/messages/conversations/${conversation.id}`;
  expect((await request(path, "employee", "POST", { body: "Private test message" })).status).toBe(200);
  expect((await request(path, "manager")).status).toBe(200);
  expect((await request(path, "owner")).status).toBe(403);
  expect((await request(path, "other")).status).toBe(404);
});
test("clock in/out and timesheet approval enforce employee and company scope", async () => {
  const start = new Date(Date.now() - 60_000);
  const end = new Date(Date.now() + 3_600_000);
  const [shift] = await testDb.insert(schema.shifts).values({ companyId, employeeId: people.employee!, title: "Clock test", startTime: start, endTime: end, status: "draft" }).returning();
  const body = { shift_id: shift!.id };
  expect((await request("/time-entries/clock-in", "employee", "POST", body)).status).toBe(400);
  await testDb.update(schema.shifts).set({ status: "published" }).where(eq(schema.shifts.id, shift!.id));
  expect((await request("/time-entries/clock-in", "other", "POST", body)).status).toBe(404);
  expect((await request("/time-entries/clock-in", "employee", "POST", body)).status).toBe(200);
  expect((await request("/time-entries/clock-in", "employee", "POST", body)).status).toBe(400);
  const out = await request("/time-entries/clock-out", "employee", "POST", body);
  expect(out.status).toBe(200);
  const { entry } = await out.json();
  expect(entry.status).toBe("pending");
  expect((await request(`/time-entries/${entry.id}/review`, "other", "POST", { decision: "approved" })).status).toBe(404);
  expect((await request(`/time-entries/${entry.id}/review`, "employee", "POST", { decision: "approved" })).status).toBe(403);
  expect((await request(`/time-entries/${entry.id}/review`, "manager", "POST", { decision: "approved", clock_in_at: start.toISOString(), clock_out_at: new Date().toISOString() })).status).toBe(200);
});
test("registration, login and password changes validate credentials and hide hashes", async () => {
  const body = { companyName: "Auth test", name: "Test owner", email: "auth-test@test.invalid", password: "test-password-123" };
  expect((await request("/auth/register-company", "anonymous", "POST", {})).status).toBe(400);
  expect((await request("/auth/register-company", "anonymous", "POST", body)).status).toBe(201);
  expect((await request("/auth/register-company", "anonymous", "POST", body)).status).toBe(400);
  expect((await request("/auth/login", "anonymous", "POST", { email: body.email, password: "wrong" })).status).toBe(401);
  const login = await request("/auth/login", "anonymous", "POST", body);
  expect(login.status).toBe(200);
  const payload = await login.json();
  expect(JSON.stringify(payload)).not.toContain("pbkdf2$");
  tokens.auth = payload.accessToken;
  expect((await request("/auth/change-password", "auth", "POST", { currentPassword: "wrong", newPassword: "replacement-password" })).status).toBe(400);
  expect((await request("/auth/change-password", "auth", "POST", { currentPassword: body.password, newPassword: "replacement-password" })).status).toBe(200);
  expect((await request("/auth/login", "anonymous", "POST", body)).status).toBe(401);
  expect((await request("/auth/login", "anonymous", "POST", { email: body.email, password: "replacement-password" })).status).toBe(200);
});
test("announcements enforce manager writes, company visibility and read tracking", async () => {
  const body = { title: "Core announcement", body: "A test update for the team." };
  expect((await request("/announcements", "employee", "POST", body)).status).toBe(403);
  expect((await request("/announcements", "manager", "POST", { title: "", body: "" })).status).toBe(400);
  const created = await request("/announcements", "manager", "POST", body);
  expect(created.status).toBe(200);
  const { announcement } = await created.json();
  expect((await (await request("/announcements")).json()).announcements).toEqual(expect.arrayContaining([expect.objectContaining({ id: announcement.id, is_read: false })]));
  expect((await (await request("/announcements", "other")).json()).announcements).toHaveLength(0);
  expect((await request(`/announcements/${announcement.id}/read`, "other", "POST")).status).toBe(404);
  expect((await request(`/announcements/${announcement.id}/read`, "employee", "POST")).status).toBe(200);
  expect((await (await request("/announcements/unread-count")).json()).count).toBe(0);
});
