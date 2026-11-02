import { schema, testDb } from "../ai/harness";
import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
const { createDraftShifts } = await import("../../src/lib/shift-create");
const { databaseConflict } = await import("../../src/lib/database-error");
async function fixture() {
  const [owner] = await testDb.insert(schema.users).values({ fullName: "Concurrency owner", email: `${crypto.randomUUID()}@concurrency.test`, role: "owner" }).returning();
  const [company] = await testDb.insert(schema.companies).values({ name: "Concurrency", ownerId: owner!.id }).returning();
  await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, owner!.id));
  return { companyId: company!.id, employeeId: owner!.id, actorId: owner!.id };
}
const start = new Date("2037-01-05T09:00:00Z"), end = new Date("2037-01-05T12:00:00Z");
test("concurrent overlapping assignments cannot both succeed", async () => {
  const f = await fixture();
  const options = { ...f, timezone: "UTC", items: [{ employeeId: f.employeeId, title: "Test shift", start, end }] };
  const results = await Promise.allSettled([createDraftShifts(options), createDraftShifts(options)]);
  expect(results.filter(r => r.status === "fulfilled" && r.value[0]!.ok)).toHaveLength(1);
  expect(await testDb.select().from(schema.shifts).where(eq(schema.shifts.employeeId, f.employeeId))).toHaveLength(1);
  expect(await testDb.select().from(schema.shiftLogs).where(eq(schema.shiftLogs.companyId, f.companyId))).toHaveLength(1);
});
test("database guard protects updates and allows adjacent shifts and different workers", async () => {
  const f = await fixture();
  const [first] = await testDb.insert(schema.shifts).values({ ...f, title: "First", startTime: start, endTime: end, status: "draft" }).returning();
  const [adjacent] = await testDb.insert(schema.shifts).values({ ...f, title: "Next", startTime: end, endTime: new Date("2037-01-05T14:00:00Z"), status: "draft" }).returning();
  let caught: unknown;
  try { await testDb.update(schema.shifts).set({ startTime: new Date("2037-01-05T11:00:00Z") }).where(eq(schema.shifts.id, adjacent!.id)); } catch (e) { caught = e; }
  expect(databaseConflict(caught)).toContain("overlapping");
  await testDb.update(schema.shifts).set({ startTime: start, endTime: end }).where(eq(schema.shifts.id, first!.id));
  const other = await fixture();
  await testDb.insert(schema.shifts).values({ ...other, title: "Other", startTime: start, endTime: end });
});
test("concurrent clock-ins for separate shifts have only one open entry", async () => {
  const f = await fixture();
  const rows = await testDb.insert(schema.shifts).values([
    { ...f, title: "One", startTime: start, endTime: end },
    { ...f, title: "Two", startTime: end, endTime: new Date("2037-01-05T15:00:00Z") },
  ]).returning();
  const results = await Promise.allSettled(rows.map(s => testDb.insert(schema.timeEntries).values({ companyId: f.companyId, employeeId: f.employeeId, shiftId: s.id, punchedInAt: start, clockInAt: start, status: "open" })));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const failed = results.find(r => r.status === "rejected");
  expect(databaseConflict(failed?.status === "rejected" ? failed.reason : null)).toContain("open clock-in");
});
