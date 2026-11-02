import { lt, sql } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import { authRateBuckets } from "../db/schema";
import { ApiError } from "./auth-guard";
import { digest } from "./account-tokens";

/** Atomic, shared across Worker isolates. Only hashed IP/account identifiers persist. */
export async function limitAuth(c: Context, action: string, account?: string) {
  const minute = Math.floor(Date.now() / 60_000);
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const limits = [{ value: `ip:${ip}`, max: action === "login" ? 30 : 10 }];
  if (account) limits.push({ value: `account:${account.trim().toLowerCase()}`, max: action === "login" ? 10 : 3 });
  const entries = await Promise.all(limits.map(async limit => ({ key: `${action}:${minute}:${await digest(limit.value)}`, max: limit.max })));
  const statements = entries.map(({ key, max }) => db.insert(authRateBuckets)
    .values({ key, attempts: 1, expiresAt: new Date((minute + 2) * 60_000) })
    .onConflictDoUpdate({ target: authRateBuckets.key, set: { attempts: sql`${authRateBuckets.attempts} + 1` }, setWhere: sql`${authRateBuckets.attempts} < ${max}` })
    .returning({ key: authRateBuckets.key }));
  const [first, ...rest] = statements;
  const results = await db.batch([db.delete(authRateBuckets).where(lt(authRateBuckets.expiresAt, new Date())).returning({ key: authRateBuckets.key }), first!, ...rest]);
  if (results.slice(1).some(rows => !rows.length)) throw new ApiError("Too many attempts. Try again in a minute.", 429);
}
