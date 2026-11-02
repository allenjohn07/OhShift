import { schema, testDb } from "../ai/harness";
import { afterEach, expect, spyOn, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
const { companyRoutes } = await import("../../src/routes/company");
const { ApiError } = await import("../../src/lib/auth-guard");
const { createAccessToken } = await import("../../src/lib/session");
const { emailTransport } = await import("../../src/lib/email");
const { deliverScheduleEmails } = await import("../../src/lib/schedule-emails");
const app = new Hono().onError((e, c) => { if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400); throw e; }).route("/company", companyRoutes);
let transportSpy: ReturnType<typeof spyOn<typeof emailTransport, "fetch">> | undefined;
afterEach(() => { transportSpy?.mockRestore(); transportSpy = undefined; });
async function fixture() {
  const [owner] = await testDb.insert(schema.users).values({ fullName: "Email owner", email: `${crypto.randomUUID()}@mail.test`, role: "owner" }).returning();
  const [company] = await testDb.insert(schema.companies).values({ name: "Mail company", ownerId: owner!.id }).returning();
  const [user] = await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, owner!.id)).returning();
  await testDb.insert(schema.shifts).values({ employeeId: user!.id, companyId: company!.id, title: "Email shift", startTime: new Date("2035-01-08T09:00:00Z"), endTime: new Date("2035-01-08T17:00:00Z"), status: "draft" });
  return { user: user!, companyId: company!.id, token: await createAccessToken(user!) };
}
async function publish(token: string) {
  return app.request("/company/schedule/publish", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ weekStart: "2035-01-08" }) });
}
test("simultaneous publishes enqueue one notification per affected worker", async () => {
  const f = await fixture();
  const responses = await Promise.all([publish(f.token), publish(f.token)]);
  expect(responses.every(r => r.status === 200)).toBe(true);
  const jobs = await testDb.select().from(schema.emailJobs).where(eq(schema.emailJobs.companyId, f.companyId));
  expect(jobs).toHaveLength(1); expect(jobs[0]!.employeeId).toBe(f.user.id);
  expect(await testDb.select().from(schema.shiftLogs).where(eq(schema.shiftLogs.companyId, f.companyId))).toHaveLength(1);
});
test("outbox delivers privately, marks completion, and never resends a completed job", async () => {
  const f = await fixture(); await publish(f.token);
  const sent: { to: string[]; text: string }[] = [];
  transportSpy = spyOn(emailTransport, "fetch").mockImplementation(async (_url, init) => { sent.push(JSON.parse(String(init.body))); return Response.json({ id: "test" }); });
  // Other fixtures may have pending jobs: inspect only this recipient.
  await deliverScheduleEmails(); await deliverScheduleEmails();
  const own = sent.filter(m => m.to.includes(f.user.email)); expect(own).toHaveLength(1);
  expect(own[0]!.to).toEqual([f.user.email]); expect(own[0]!.text).not.toContain("Email owner");
  const [job] = await testDb.select().from(schema.emailJobs).where(eq(schema.emailJobs.companyId, f.companyId));
  expect(job!.status).toBe("sent");
});
test("provider failures retain a retryable job instead of losing notification", async () => {
  const f = await fixture(); await publish(f.token);
  transportSpy = spyOn(emailTransport, "fetch").mockImplementation(async () => Response.json({ error: "rejected" }, { status: 403 }));
  await deliverScheduleEmails();
  const [job] = await testDb.select().from(schema.emailJobs).where(eq(schema.emailJobs.companyId, f.companyId));
  expect(job!.status).toBe("pending"); expect(job!.attempts).toBe(1); expect(job!.availableAt.getTime()).toBeGreaterThan(Date.now());
});

test("a crashed final delivery attempt becomes a visible terminal failure", async () => {
  const f = await fixture(); await publish(f.token);
  await testDb.update(schema.emailJobs).set({ status: "sending", attempts: 6, leaseUntil: new Date(0), leaseToken: "expired-claim" }).where(eq(schema.emailJobs.companyId, f.companyId));
  transportSpy = spyOn(emailTransport, "fetch").mockImplementation(async () => Response.json({ id: "test" }));
  await deliverScheduleEmails();
  const [job] = await testDb.select().from(schema.emailJobs).where(eq(schema.emailJobs.companyId, f.companyId));
  expect(job!.status).toBe("failed"); expect(job!.leaseToken).toBeNull();
});
