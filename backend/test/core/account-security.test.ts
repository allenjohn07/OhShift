import { schema, testDb } from "../ai/harness";
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
const { authRoutes } = await import("../../src/routes/auth");
const { employeesRoutes } = await import("../../src/routes/employees");
const { ApiError } = await import("../../src/lib/auth-guard");
const { createAccessToken } = await import("../../src/lib/session");
const { hashPassword, verifyPassword } = await import("../../src/lib/password");
const { consumeAccountToken, digest, sendAccountLink } = await import("../../src/lib/account-tokens");
const { sendEmail, emailTransport } = await import("../../src/lib/email");
const app = new Hono().onError((e, c) => {
  if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400);
  throw e;
}).route("/auth", authRoutes).route("/employees", employeesRoutes);
type Mail = { to: string[]; text: string; subject: string };
let sent: Mail[];
let fetchSpy: ReturnType<typeof spyOn<typeof emailTransport, "fetch">>;
beforeEach(() => {
  sent = [];
  fetchSpy = spyOn(emailTransport, "fetch").mockImplementation(async (_input, init) => {
    sent.push(JSON.parse(String(init?.body)) as Mail);
    return Response.json({ id: "test-message-id" });
  });
});
afterEach(() => fetchSpy.mockRestore());
async function fixture() {
  const [owner] = await testDb.insert(schema.users).values({ email: `${crypto.randomUUID()}@security.test`, fullName: "Security owner", role: "owner", passwordHash: await hashPassword("original-password-123") }).returning();
  const [company] = await testDb.insert(schema.companies).values({ name: "Security company", ownerId: owner!.id }).returning();
  const [user] = await testDb.update(schema.users).set({ companyId: company!.id }).where(eq(schema.users.id, owner!.id)).returning();
  return { user: user!, token: await createAccessToken(user!), ip: crypto.randomUUID() };
}
async function call(path: string, body?: object, token?: string, ip = crypto.randomUUID()) {
  const pending: Promise<unknown>[] = [];
  const response = await app.request(path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }, undefined, { waitUntil: (p: Promise<unknown>) => { pending.push(p); }, passThroughOnException() {}, props: {} });
  await Promise.all(pending);
  return response;
}
function linkToken() {
  const token = sent.at(-1)?.text.match(/\/set-password#([a-f0-9]{64})/)?.[1];
  expect(token).toBeDefined();
  return token!;
}
test("recovery is generic, sends only to the account email and never returns a credential", async () => {
  const { user } = await fixture();
  const known = await call("/auth/reset-password", { email: user.email });
  const unknown = await call("/auth/reset-password", { email: "missing@security.test" });
  expect(known.status).toBe(200); expect(unknown.status).toBe(200);
  const payload = await known.json();
  expect(payload).toEqual(await unknown.json());
  expect(JSON.stringify(payload)).not.toContain(linkToken());
  expect(JSON.stringify(payload)).not.toContain("tempPassword");
  expect(sent).toHaveLength(1); expect(sent[0]!.to).toEqual([user.email]);
  const stored = await testDb.query.users.findFirst({ where: eq(schema.users.id, user.id) });
  expect(await verifyPassword("original-password-123", stored!.passwordHash)).toBe(true);
  const rows = await testDb.select().from(schema.accountTokens).where(eq(schema.accountTokens.userId, user.id));
  expect(rows[0]!.tokenHash).toBe(await digest(linkToken()));
  expect(JSON.stringify(rows)).not.toContain(linkToken());
});
test("redeeming a link changes the password once and revokes all older sessions", async () => {
  const { user, token } = await fixture();
  await call("/auth/reset-password", { email: user.email });
  const raw = linkToken();
  expect((await call("/auth/set-password", { token: raw, password: "replacement-password-123" })).status).toBe(200);
  expect((await call("/auth/set-password", { token: raw, password: "another-password-123" })).status).toBe(400);
  const session = await (await call("/auth/me", undefined, token)).json() as { user: unknown };
  expect(session.user).toBeNull();
  expect((await call("/auth/login", { email: user.email, password: "original-password-123" })).status).toBe(401);
  expect((await call("/auth/login", { email: user.email, password: "replacement-password-123" })).status).toBe(200);
});
test("expired and malformed links cannot change a password", async () => {
  const { user } = await fixture();
  await sendAccountLink(user, "reset");
  const raw = linkToken();
  await testDb.update(schema.accountTokens).set({ expiresAt: new Date(0) }).where(eq(schema.accountTokens.userId, user.id));
  expect((await call("/auth/set-password", { token: raw, password: "replacement-password-123" })).status).toBe(400);
  expect((await call("/auth/set-password", { token: "bad", password: "replacement-password-123" })).status).toBe(400);
});
test("concurrent redemptions have exactly one winner", async () => {
  const { user } = await fixture(); await sendAccountLink(user, "reset"); const raw = linkToken();
  const results = await Promise.allSettled([consumeAccountToken(raw, "replacement-password-123"), consumeAccountToken(raw, "another-password-123")]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
});
test("password changes require the current password and revoke the acting session", async () => {
  const { token } = await fixture();
  expect((await call("/auth/change-password", { currentPassword: "wrong", newPassword: "replacement-password-123" }, token)).status).toBe(400);
  expect((await call("/auth/change-password", { currentPassword: "original-password-123", newPassword: "short" }, token)).status).toBe(400);
  expect((await call("/auth/change-password", { currentPassword: "original-password-123", newPassword: "replacement-password-123" }, token)).status).toBe(200);
  expect((await call("/employees/invite", { invites: [{ fullName: "Test invite", email: "revoked@example.invalid" }] }, token)).status).toBe(401);
});
test("invitations email an expiring setup link, never a password, and cannot claim another company", async () => {
  const { token } = await fixture(); const email = `${crypto.randomUUID()}@invites.test`;
  const response = await call("/employees/invite", { invites: [{ fullName: "New teammate", email }] }, token);
  expect(response.status).toBe(200);
  const payload = JSON.stringify(await response.json());
  expect(payload).not.toContain("inviteCode"); expect(payload).not.toContain(linkToken());
  expect(sent[0]!.to).toEqual([email]);
  const invited = await testDb.query.users.findFirst({ where: eq(schema.users.email, email) });
  expect(invited!.passwordHash).toBeNull();
  const other = await fixture();
  expect((await call("/employees/invite", { invites: [{ fullName: "Takeover", email }] }, other.token)).status).toBe(400);
  expect((await call("/auth/set-password", { token: linkToken(), password: "invited-password-123" })).status).toBe(200);
  expect((await call("/auth/login", { email, password: "invited-password-123" })).status).toBe(200);
});
test("recovery provider failures remain generic and leave no usable token", async () => {
  const { user } = await fixture();
  fetchSpy.mockImplementation(async () => Response.json({ message: "sensitive provider details" }, { status: 403 }));
  const response = await call("/auth/reset-password", { email: user.email });
  expect(response.status).toBe(200); expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  expect(await testDb.select().from(schema.accountTokens).where(eq(schema.accountTokens.userId, user.id))).toHaveLength(0);
});
test("email retries preserve the provider idempotency key", async () => {
  const headers: string[] = [];
  fetchSpy.mockImplementation(async (_input, init) => {
    headers.push(new Headers(init?.headers).get("Idempotency-Key")!);
    if (headers.length === 1) throw new Error("network failure");
    return Response.json({ id: "test-id" });
  });
  await sendEmail({ to: "test@example.invalid", text: "Test", subject: "Test", idempotencyKey: "stable-test-key" });
  expect(headers).toEqual(["stable-test-key", "stable-test-key"]);
});
test("distributed login attempts are capped per account", async () => {
  const email = `${crypto.randomUUID()}@security.test`;
  for (let i = 0; i < 10; i++) expect((await call("/auth/login", { email, password: "wrong" })).status).toBe(401);
  expect((await call("/auth/login", { email, password: "wrong" })).status).toBe(429);
});

test("account throttles normalize email case and surrounding whitespace", async () => {
  const email = `${crypto.randomUUID()}@security.test`;
  for (let i = 0; i < 10; i++) expect((await call("/auth/login", { email: i % 2 ? ` ${email.toUpperCase()} ` : email, password: "wrong" })).status).toBe(401);
  expect((await call("/auth/login", { email: `  ${email}  `, password: "wrong" })).status).toBe(429);
});
