import { sql } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../../db";
import { authRateBuckets, type UserRole } from "../../db/schema";
import { digest } from "../account-tokens";
import { ApiError, type SessionUser } from "../auth-guard";

/**
 * Demo sandboxes: each "Try the live demo" visitor gets a private, seeded
 * company (`seed.ts`) that is deleted after DEMO_TTL_MS (`cleanup.ts`).
 * Demo users have no password and an unroutable address, so they can only be
 * reached through `/demo/*` tokens and never receive email.
 */
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
export const DEMO_AI_QUESTIONS = 5;
export const DEMO_MAX_ACTIVE = 2000;
const DEMO_EMAIL_SUFFIX = ".demo.invalid";

/** The seeded people the role switcher signs in as. */
export const DEMO_PERSONAS: Record<UserRole, string> = {
  owner: "alex.morgan",
  manager: "priya.patel",
  employee: "sam.rivera",
};

export function demoEmail(localPart: string, companyId: string) {
  return `${localPart}@${companyId.replace(/-/g, "").slice(0, 12)}${DEMO_EMAIL_SUFFIX}`;
}

export function isDemoEmail(email: string) {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}

export function isDemoUser(user: Pick<SessionUser, "company">) {
  return Boolean(user.company?.demoExpiresAt);
}

export function assertNotDemo(user: Pick<SessionUser, "company">) {
  if (isDemoUser(user)) throw new ApiError("Not available in the demo.", 403);
}

/** One atomic counter in `auth_rate_buckets`; throws once `max` is reached. */
async function consume(key: string, max: number, expiresAt: Date, message: string) {
  const [row] = await db.insert(authRateBuckets)
    .values({ key, attempts: 1, expiresAt })
    .onConflictDoUpdate({ target: authRateBuckets.key, set: { attempts: sql`${authRateBuckets.attempts} + 1` }, setWhere: sql`${authRateBuckets.attempts} < ${max}` })
    .returning({ key: authRateBuckets.key });
  if (!row) throw new ApiError(message, 429);
}

/** At most 20 new sandboxes per IP per hour (on top of the per-minute `limitAuth`). */
export async function limitDemoStarts(c: Context) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  await consume(`demo-start:${hour}:${await digest(`ip:${ip}`)}`, 20, new Date((hour + 2) * 3_600_000), "Too many demos started. Try again later.");
}

/** Assistant questions are metered: each sandbox gets DEMO_AI_QUESTIONS in total. */
export async function enforceDemoAiAllowance(user: Pick<SessionUser, "company" | "companyId">) {
  const expiresAt = user.company?.demoExpiresAt;
  if (!expiresAt || !user.companyId) return;
  await consume(`demo-ai:${user.companyId}`, DEMO_AI_QUESTIONS, expiresAt, `The demo includes ${DEMO_AI_QUESTIONS} assistant questions. Create your company to keep asking.`);
}
