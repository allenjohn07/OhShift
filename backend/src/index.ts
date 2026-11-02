import { deliverScheduleEmails } from "./lib/schedule-emails";
import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { db } from "./db";
import { databaseConflict } from "./lib/database-error";
import { ApiError } from "./lib/auth-guard";
import { aiRoutes } from "./routes/ai";
import { announcementsRoutes } from "./routes/announcements";
import { authRoutes } from "./routes/auth";
import { availabilityRoutes } from "./routes/availability";
import { companyRoutes } from "./routes/company";
import { dashboardRoutes } from "./routes/dashboard";
import { employeesRoutes } from "./routes/employees";
import { inboxRoutes } from "./routes/inbox";
import { messagesRoutes } from "./routes/messages";
import { shiftsRoutes } from "./routes/shifts";
import { timeEntriesRoutes } from "./routes/time-entries";
import { timeOffRoutes } from "./routes/time-off";

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const vars = env as unknown as Record<string, string | undefined>;

const configuredOrigins = [
  vars.APP_URL ?? vars.FRONTEND_URL,
  ...(vars.FRONTEND_URLS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
]
  .filter((value): value is string => Boolean(value))
  .map(parseOrigin)
  .filter((value): value is string => Boolean(value));

function allowOrigin(origin: string): string | null {
  if (configuredOrigins.length > 0) {
    return configuredOrigins.includes(origin) ? origin : null;
  }
  if (
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000" ||
    /^https:\/\/.*\.pages\.dev$/.test(origin)
  ) {
    return origin;
  }
  return null;
}

export const app = new Hono()
  .use(bodyLimit({ maxSize: 64 * 1024, onError: c => c.json({ error: "Request body too large" }, 413) }))
  .use(
    cors({
      origin: allowOrigin,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .get("/ping", (c) =>
    c.json({
      ok: true,
      service: "ohshift-api",
      timestamp: new Date().toISOString(),
    }),
  )
  .get("/health", async (c) => {
    try {
      await db.run(sql`SELECT 1`);
      return c.json({
        ok: true,
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      return c.json({
        ok: false,
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  })
  .get("/", (c) =>
    c.json({
      name: "OhShifts API",
      docs: "JWT Bearer auth. Routes: /auth, /shifts, /employees, /company, /dashboard, /availability, /time-off, /time-entries, /announcements, /messages, /inbox, /ai",
    }),
  )
  .route("/auth", authRoutes)
  .route("/company", companyRoutes)
  .route("/employees", employeesRoutes)
  .route("/shifts", shiftsRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/availability", availabilityRoutes)
  .route("/time-off", timeOffRoutes)
  .route("/time-entries", timeEntriesRoutes)
  .route("/announcements", announcementsRoutes)
  .route("/messages", messagesRoutes)
  .route("/inbox", inboxRoutes)
  .route("/ai", aiRoutes)
  .notFound((c) => c.json({ error: "Not found" }, 404))
  .onError((err, c) => {
    const conflict = databaseConflict(err);
    if (conflict) return c.json({ error: conflict }, 409);
    let cause: unknown = err;
    for (let depth = 0; depth < 8 && cause instanceof Error; depth++, cause = cause.cause) {
      if (cause.message.includes("OHSHIFT_HISTORY_PROTECTED")) return c.json({ error: "This change would remove historical time records and is not allowed." }, 409);
    }
    if (err instanceof ApiError) {
      return c.json({ error: err.message }, err.status as 400);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

export type AppType = typeof app;

export default Object.assign(app, {
  async scheduled() { await deliverScheduleEmails(); },
});
