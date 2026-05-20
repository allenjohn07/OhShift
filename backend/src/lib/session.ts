import { decode, encode } from "@auth/core/jwt";
import { prisma } from "./prisma";
import type { UserRole } from "@prisma/client";

const SESSION_SALT = "authjs.session-token";

export type AuthPayload = {
  sub: string;
  email?: string;
  role?: UserRole;
  companyId?: string | null;
};

export async function getAuthFromBearer(
  authorization: string | null,
): Promise<AuthPayload | null> {
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7);
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  try {
    const payload = (await decode({
      token,
      secret,
      salt: SESSION_SALT,
    })) as AuthPayload | null;

    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function createAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return encode({
    token: {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    },
    secret,
    salt: SESSION_SALT,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getDbUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });
}
