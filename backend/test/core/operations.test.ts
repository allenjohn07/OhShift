import { testDb } from "../ai/harness";
import { expect, spyOn, test } from "bun:test";
const { default: app } = await import("../../src/index");
test("health failures return 503 and successful responses carry safety and trace headers", async () => {
  const healthy = await app.request("/health");
  expect(healthy.status).toBe(200);
  expect(healthy.headers.get("x-content-type-options")).toBe("nosniff");
  expect(healthy.headers.get("x-request-id")).toBeTruthy();
  const failure = spyOn(testDb, "run").mockRejectedValue(new Error("test database unavailable"));
  try { expect((await app.request("/health")).status).toBe(503); }
  finally { failure.mockRestore(); }
});
test("production without configured origins never trusts arbitrary Pages sites", async () => {
  const { env } = await import("cloudflare:workers");
  const vars = env as unknown as Record<string, string | undefined>;
  const previous = vars.NODE_ENV; vars.NODE_ENV = "production";
  try {
    const response = await app.request("/ping", { headers: { Origin: "https://attacker.pages.dev" } });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  } finally { vars.NODE_ENV = previous; }
});
