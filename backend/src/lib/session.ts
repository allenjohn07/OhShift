import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { sign, verify } from "hono/jwt";
import { db } from "../db";
import { users, type UserRole } from "../db/schema";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export type AuthPayload = {
  sub: string;
  email?: string;
  role?: UserRole;
  companyId?: string | null;
};

function authSecret() {
  const secret = env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return secret;
}

export async function getAuthFromBearer(
  authorization: string | null | undefined,
): Promise<AuthPayload | null> {
  if (!authorization?.startsWith("Bearer ")) return null;

  try {
    const payload = (await verify(
      authorization.slice(7),
      authSecret(),
      "HS256",
    )) as AuthPayload;
    return payload?.sub ? payload : null;
  } catch {
    return null;
  }
}

export async function createAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      iat: now,
      exp: now + SESSION_MAX_AGE,
    },
    authSecret(),
    "HS256",
  );
}

export async function getDbUser(userId: string) {
  return db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.isActive, true)),
    with: { company: true },
  });
}
