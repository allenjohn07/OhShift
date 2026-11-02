import { schema, testDb } from "../ai/harness";
import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
const { employeesRoutes } = await import("../../src/routes/employees");
const { shiftsRoutes } = await import("../../src/routes/shifts");
const { dashboardRoutes } = await import("../../src/routes/dashboard");
const { ApiError } = await import("../../src/lib/auth-guard");
const { createAccessToken } = await import("../../src/lib/session");
const { createDraftShifts } = await import("../../src/lib/shift-create");
const app = new Hono().onError((e, c) => { if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400); throw e; }).route("/employees", employeesRoutes).route("/shifts", shiftsRoutes).route("/dashboard", dashboardRoutes);
async function fixture(status: "pending" | "open" = "pending") {
  const [owner, employee] = await testDb.insert(schema.users).values([
    { fullName: "Retention owner", email: `${crypto.randomUUID()}@history.test`, role: "owner" },
    { fullName: "Retention employee", email: `${crypto.randomUUID()}@history.test`, role: "employee" },
  ]).returning();
  const [company] = await testDb.insert(schema.companies).values({ ownerId: owner!.id, name: "Retention company" }).returning();
  const people = await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, owner!.id)).returning();
  await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, employee!.id));
  const [shift] = await testDb.insert(schema.shifts).values({ companyId: company!.id, employeeId: employee!.id, title: "Historical shift", startTime: new Date("2035-01-08T09:00:00Z"), endTime: new Date("2035-01-08T17:00:00Z") }).returning();
  const [entry] = await testDb.insert(schema.timeEntries).values({ companyId: company!.id, employeeId: employee!.id, shiftId: shift!.id, punchedInAt: shift!.startTime, clockInAt: shift!.startTime, punchedOutAt: status === "open" ? null : shift!.endTime, clockOutAt: status === "open" ? null : shift!.endTime, status }).returning();
  return { owner: people[0]!, employee: { ...employee!, companyId: company!.id }, shift: shift!, entry: entry!, companyId: company!.id };
}
async function req(path: string, user: Parameters<typeof createAccessToken>[0], method = "GET", body?: object) {
  return app.request(path, { method, headers: { Authorization: `Bearer ${await createAccessToken(user)}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
test("deactivation preserves records, removes roster access and rejects future assignments", async () => {
  const f = await fixture();
  expect((await req(`/employees?id=${f.employee.id}`, f.owner, "DELETE")).status).toBe(200);
  expect((await testDb.query.users.findFirst({ where: eq(schema.users.id, f.employee.id) }))!.isActive).toBe(false);
  expect(await testDb.query.shifts.findFirst({ where: eq(schema.shifts.id, f.shift.id) })).toBeDefined();
  expect(await testDb.query.timeEntries.findFirst({ where: eq(schema.timeEntries.id, f.entry.id) })).toBeDefined();
  expect((await req("/shifts/mine", f.employee)).status).toBe(401);
  const dashboard = await (await req("/dashboard/company", f.owner)).json() as { employees: { id: string }[] };
  expect(dashboard.employees.some(p => p.id === f.employee.id)).toBe(false);
  const [result] = await createDraftShifts({ companyId: f.companyId, actorId: f.owner.id, timezone: "UTC", items: [{ employeeId: f.employee.id, title: "No", start: new Date("2035-02-01T09:00:00Z"), end: new Date("2035-02-01T12:00:00Z") }] });
  expect(result!.ok).toBe(false);
});
test("deactivation cannot strand an open clock-in", async () => {
  const f = await fixture("open");
  expect((await req(`/employees?id=${f.employee.id}`, f.owner, "DELETE")).status).toBe(409);
});
test("shifts with time entries cannot be deleted or rescheduled", async () => {
  const f = await fixture();
  expect((await req(`/shifts?id=${f.shift.id}`, f.owner, "DELETE")).status).toBe(409);
  expect((await req("/shifts", f.owner, "PUT", { shiftId: f.shift.id, title: "Changed", startTime: "2035-01-09T09:00:00Z", endTime: "2035-01-09T17:00:00Z", timezone: "UTC" })).status).toBe(409);
  let rejected = false;
  try { await testDb.delete(schema.shifts).where(eq(schema.shifts.id, f.shift.id)); } catch { rejected = true; }
  expect(rejected).toBe(true);
  expect(await testDb.query.timeEntries.findFirst({ where: eq(schema.timeEntries.id, f.entry.id) })).toBeDefined();
});
