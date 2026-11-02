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
  console.log("Workers/D1 runtime checks passed (migrations, auth, draft visibility, and installed integrity/recovery guards).");
} finally {
  if (mf) await mf.dispose();
  rmSync(scratch, { recursive: true, force: true });
}
