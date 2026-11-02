import { schema, testDb } from "../ai/harness";
import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
const { default: app } = await import("../../src/index");
const { createAccessToken } = await import("../../src/lib/session");
async function fixture() {
  const [owner, employee] = await testDb.insert(schema.users).values([
    { email: `${crypto.randomUUID()}@pages.test`, fullName: "Pages owner", role: "owner" },
    { email: `${crypto.randomUUID()}@pages.test`, fullName: "Pages employee", role: "employee" },
  ]).returning();
  const [company] = await testDb.insert(schema.companies).values({ name: "Pages", ownerId: owner!.id }).returning();
  const updated = await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, employee!.id)).returning();
  const own = await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, owner!.id)).returning();
  return { employee: updated[0]!, owner: own[0]!, companyId: company!.id };
}
async function get(path: string, user: Parameters<typeof createAccessToken>[0]) {
  return app.request(path, { headers: { Authorization: `Bearer ${await createAccessToken(user)}` } });
}
test("threads show newest messages and cursor history has no omissions at equal timestamps", async () => {
  const f = await fixture();
  const [conversation] = await testDb.insert(schema.conversations).values({ companyId: f.companyId, pairKey: `${f.owner.id}:${f.employee.id}` }).returning();
  await testDb.insert(schema.conversationParticipants).values([{ conversationId: conversation!.id, userId: f.owner.id }, { conversationId: conversation!.id, userId: f.employee.id }]);
  for (let i = 0; i < 205; i++) await testDb.insert(schema.directMessages).values({ id: `message-${String(i).padStart(4, "0")}`, conversationId: conversation!.id, senderId: f.owner.id, body: `Message ${i}`, createdAt: new Date("2035-01-01T12:00:00Z") });
  const path = `/messages/conversations/${conversation!.id}`;
  type Page = { messages: { id: string }[]; next_cursor: string | null };
  const first = await (await get(path, f.employee)).json() as Page;
  expect(first.messages).toHaveLength(100); expect(first.messages.at(-1)!.id).toBe("message-0204");
  const ids = first.messages.map(m => m.id); let cursor = first.next_cursor;
  while (cursor) {
    const page = await (await get(`${path}?before=${cursor}`, f.employee)).json() as Page;
    ids.push(...page.messages.map(m => m.id)); cursor = page.next_cursor;
  }
  expect(ids).toHaveLength(205); expect(new Set(ids).size).toBe(205);
  expect((await get(`${path}?before=invalid`, f.employee)).status).toBe(400);
  const other = await fixture(); expect((await get(path, other.owner)).status).toBe(404);
});
test("schedule APIs bound date ranges, include overnight overlaps and preserve draft visibility", async () => {
  const f = await fixture();
  await testDb.insert(schema.shifts).values([
    { companyId: f.companyId, employeeId: f.employee.id, title: "Overnight", startTime: new Date("2035-01-07T22:00:00Z"), endTime: new Date("2035-01-08T04:00:00Z"), status: "published" },
    { companyId: f.companyId, employeeId: f.employee.id, title: "Draft", startTime: new Date("2035-01-08T09:00:00Z"), endTime: new Date("2035-01-08T17:00:00Z"), status: "draft" },
    { companyId: f.companyId, employeeId: f.employee.id, title: "Old", startTime: new Date("2034-01-08T09:00:00Z"), endTime: new Date("2034-01-08T17:00:00Z"), status: "published" },
  ]);
  const range = "?from=2035-01-08T00:00:00Z&to=2035-01-15T00:00:00Z";
  const mine = await (await get(`/shifts/mine${range}`, f.employee)).json() as { shifts: { title: string }[] };
  expect(mine.shifts.map(s => s.title)).toEqual(["Overnight"]);
  const team = await (await get(`/shifts/company${range}`, f.owner)).json() as { shifts: { title: string }[] };
  expect(team.shifts.map(s => s.title)).toEqual(["Overnight", "Draft"]);
  expect((await get(`/shifts/company${range}`, f.employee)).status).toBe(403);
  expect((await get("/dashboard/company?from=2035-01-01&to=2036-01-01", f.owner)).status).toBe(400);
  const defaults = await (await get("/dashboard/company", f.owner)).json() as { shifts: object[] };
  expect(defaults.shifts).toHaveLength(0);
});
