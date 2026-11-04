// Tests actual workerd/D1 without Wrangler, production bindings or local env files.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const scratch = mkdtempSync(join(tmpdir(), "ohshift-runtime-"));
let mf;
try {
  const bundle = join(scratch, "worker.mjs");
  await build({ entryPoints: ["src/index.ts"], bundle: true, format: "esm", platform: "browser", external: ["cloudflare:workers"], outfile: bundle });
  const sent = [];
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: readFileSync(bundle, "utf8"), compatibilityDate: "2026-10-01", d1Databases: ["DB"], bindings: { AUTH_SECRET: "runtime-only-test-key-at-least-32-characters", FRONTEND_URL: "https://app.runtime.test", APP_URL: "https://app.runtime.test", EMAIL_FROM: "OhShift <test@example.invalid>", RESEND_API_KEY: "runtime-test-only", NODE_ENV: "test" }, outboundService: async request => { sent.push(await request.json()); return Response.json({ id: "runtime-email" }); } }));
  const db = await mf.getD1Database("DB");
  for (const name of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) {
    const statements = readFileSync(join("drizzle", name), "utf8").split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean);
    await db.batch(statements.map(sql => db.prepare(sql)));
  }
  async function request(path, body, token) {
    return mf.dispatchFetch(`https://api.runtime.test${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  }
  assert.equal((await request("/health")).status, 200);
  assert.equal((await request("/shifts/mine")).status, 401);
  assert.equal((await request("/auth/register-company", { companyName: "Runtime", name: "Runtime owner", email: "owner@runtime.test", password: "runtime-password-123" })).status, 201);
  const login = await request("/auth/login", { email: "owner@runtime.test", password: "runtime-password-123" });
  assert.equal(login.status, 200); const { accessToken, user } = await login.json();
  const date = new Date(Date.now() + 86_400_000); date.setUTCHours(9, 0, 0, 0);
  const end = new Date(date.getTime() + 3_600_000);
  const shift = { employeeId: user.id, title: "Runtime shift", startTime: date.toISOString(), endTime: end.toISOString(), timezone: "UTC" };
  if (existsSync("drizzle/0003_scheduling_integrity.sql")) {
    const responses = await Promise.all([request("/shifts", shift, accessToken), request("/shifts", shift, accessToken)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  } else assert.equal((await request("/shifts", shift, accessToken)).status, 200);
  const mine = await request("/shifts/mine", undefined, accessToken); assert.equal(mine.status, 200); assert.equal((await mine.json()).shifts.length, 0);
  // Publishing goes through a multi-statement D1 batch (outbox + log + update).
  const publishRes = await request("/company/schedule/publish", { weekStart: date.toISOString().slice(0, 10), from: new Date(date.getTime() - 3_600_000).toISOString(), to: end.toISOString() }, accessToken);
  assert.equal(publishRes.status, 200, await publishRes.clone().text());
  assert.equal((await publishRes.json()).publishedCount, 1);
  if (existsSync("drizzle/0002_supreme_dreadnoughts.sql")) {
    const response = await request("/auth/reset-password", { email: "owner@runtime.test" });
    assert.equal(response.status, 200); assert.equal("tempPassword" in await response.json(), false);
    // Wait for the Worker execution context's background delivery, with a bounded deadline.
    for (let i = 0; i < 100 && !sent.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(sent.length, 1);
    const token = sent[0].text.match(/\/set-password#([a-f0-9]{64})/)[1];
    const results = await Promise.all([request("/auth/set-password", { token, password: "new-runtime-password-123" }), request("/auth/set-password", { token, password: "other-runtime-password-123" })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal((await (await request("/auth/me", undefined, accessToken)).json()).user, null);
  }
  if (existsSync("src/routes/demo.ts")) {
    // Real D1 caps bound parameters per statement (100); the seeder and demo invites must stay under it.
    const mailBefore = sent.length;
    const started = await request("/demo/start", { timezone: "Asia/Kolkata" });
    assert.equal(started.status, 201);
    const demo = await started.json();
    assert.equal(demo.user.profile.companies.is_demo, true);
    const employee = await request("/demo/switch", { role: "employee" }, demo.accessToken);
    assert.equal(employee.status, 200); assert.equal((await employee.json()).user.profile.role, "employee");
    const crew = Array.from({ length: 20 }, (_, i) => ({ email: `crew${i}@example.com`, fullName: `Crew ${i}` }));
    assert.equal((await request("/employees/invite", { invites: crew }, demo.accessToken)).status, 200);
    // Publishing next week's seeded drafts (the tour's "Publish next week" step).
    const nextWeek = new Date(); nextWeek.setUTCDate(nextWeek.getUTCDate() + ((8 - nextWeek.getUTCDay()) % 7 || 7)); nextWeek.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(nextWeek.getTime() + 7 * 86_400_000);
    const published = await request("/company/schedule/publish", { weekStart: nextWeek.toISOString().slice(0, 10), from: new Date(nextWeek.getTime() - 86_400_000).toISOString(), to: weekEnd.toISOString() }, demo.accessToken);
    const publishBody = await published.json();
    assert.equal(published.status, 200, JSON.stringify(publishBody));
    assert.ok(publishBody.publishedCount > 0);
    assert.equal(sent.length, mailBefore);
    // The cron's cleanup removes expired sandboxes (one D1 batch of deletes).
    const sandboxId = demo.user.profile.company_id;
    await db.prepare("UPDATE companies SET demo_expires_at = ? WHERE id = ?").bind(Date.now() - 1000, sandboxId).run();
    const worker = await mf.getWorker();
    await worker.scheduled({ scheduledTime: new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000), cron: "* * * * *" });
    assert.equal((await db.prepare("SELECT count(*) AS n FROM companies WHERE id = ?").bind(sandboxId).first()).n, 0);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM users WHERE email LIKE '%.demo.invalid'").first()).n, 0);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM shifts WHERE company_id = ?").bind(sandboxId).first()).n, 0);
  }
  console.log("Workers/D1 runtime checks passed (migrations, auth, draft visibility, demo sandboxes, and installed integrity/recovery guards).");
} finally {
  if (mf) await mf.dispose();
  rmSync(scratch, { recursive: true, force: true });
}
