import { and, asc, count, eq, gt, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { companies, USER_ROLES, users, type UserRole } from "../db/schema";
import { ApiError, jsonBody, requireUser } from "../lib/auth-guard";
import { limitAuth } from "../lib/auth-rate-limit";
import { DEMO_MAX_ACTIVE, DEMO_PERSONAS, demoEmail, isDemoUser, limitDemoStarts } from "../lib/demo";
import { seedDemoCompany } from "../lib/demo/seed";
import { serializeUser } from "../lib/serialize";
import { createAccessToken, getDbUser } from "../lib/session";
import * as v from "../lib/validation";

/** Same shape as `/auth/login`, so the client stores the session the same way. */
async function sessionFor(userId: string) {
  const user = await getDbUser(userId);
  if (!user) throw new ApiError("Demo user not found", 404);
  return {
    accessToken: await createAccessToken(user),
    user: { id: user.id, email: user.email, profile: serializeUser(user) },
  };
}

/** The persona for `role`, or (if the visitor changed their role) anyone active with it. */
async function memberWithRole(companyId: string, role: UserRole) {
  const persona = await db.query.users.findFirst({
    where: and(eq(users.companyId, companyId), eq(users.email, demoEmail(DEMO_PERSONAS[role], companyId)), eq(users.role, role), eq(users.isActive, true)),
    columns: { id: true },
  });
  return persona ?? db.query.users.findFirst({
    where: and(eq(users.companyId, companyId), eq(users.role, role), eq(users.isActive, true)),
    orderBy: asc(users.createdAt),
    columns: { id: true },
  });
}

export const demoRoutes = new Hono()
  .post("/start", jsonBody<{ timezone: string }>({ timezone: v.timezone }), async (c) => {
    await limitAuth(c, "demo");
    await limitDemoStarts(c);
    const [active] = await db.select({ n: count() }).from(companies)
      .where(and(isNotNull(companies.demoExpiresAt), gt(companies.demoExpiresAt, new Date())));
    if ((active?.n ?? 0) >= DEMO_MAX_ACTIVE) {
      return c.json({ error: "The demo is very busy right now. Try again in a few minutes." }, 503);
    }
    const { ownerId } = await seedDemoCompany({ timeZone: c.req.valid("json").timezone || "UTC" });
    return c.json(await sessionFor(ownerId), 201);
  })
  .post("/switch", jsonBody<{ role: UserRole }>({ role: v.oneOf(...USER_ROLES) }), async (c) => {
    const user = await requireUser(c);
    if (!isDemoUser(user) || !user.companyId) {
      return c.json({ error: "Only available in the demo." }, 403);
    }
    const { role } = c.req.valid("json");
    if (!role) return c.json({ error: "role is required" }, 400);
    const target = await memberWithRole(user.companyId, role);
    if (!target) {
      return c.json({ error: `Nobody in this demo is a ${role} right now. Promote someone first.` }, 409);
    }
    return c.json(await sessionFor(target.id));
  });
