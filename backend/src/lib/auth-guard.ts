import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { validator } from "hono/validator";
import { db } from "../db";
import { users, type UserRole } from "../db/schema";
import { getAuthFromBearer, getDbUser } from "./session";

/** Thrown from handlers/helpers; the app's onError maps it to `{ error }` + status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getDbUser>>>;

export async function requireUser(c: Context) {
  const payload = await getAuthFromBearer(c.req.header("authorization"));
  if (!payload?.sub) {
    throw new ApiError("Unauthorized", 401);
  }

  const user = await getDbUser(payload.sub);
  if (!user || payload.sessionVersion !== user.sessionVersion) {
    throw new ApiError("Unauthorized", 401);
  }

  return user;
}

export function assertManager(user: SessionUser) {
  if (user.role !== "owner" && user.role !== "manager") {
    throw new ApiError("Forbidden", 403);
  }
  if (!user.companyId) {
    throw new ApiError("No company associated with user", 400);
  }
  return user as SessionUser & { companyId: string };
}

export function assertOwner(user: SessionUser) {
  const manager = assertManager(user);
  if (manager.role !== "owner") {
    throw new ApiError("Only the company owner can perform this action", 403);
  }
  return manager;
}

export async function requireManager(c: Context) {
  return assertManager(await requireUser(c));
}

export async function requireOwner(c: Context) {
  return assertOwner(await requireUser(c));
}

export function requireCompanyMember(user: { companyId: string | null }) {
  if (!user.companyId) {
    throw new ApiError("No company associated with user", 400);
  }
  return user.companyId;
}

export function isManagerRole(role: UserRole) {
  return role === "owner" || role === "manager";
}

export async function verifyEmployeeInCompany(
  employeeId: string,
  companyId: string,
) {
  const employee = await db.query.users.findFirst({
    where: and(eq(users.id, employeeId), eq(users.companyId, companyId), eq(users.isActive, true)),
  });
  if (!employee) {
    throw new ApiError("Invalid employee", 400);
  }
  return employee;
}

/**
 * Route middleware for a JSON body: `.post("/", jsonBody<Body>(), (c) => c.req.valid("json"))`.
 * Fields stay optional (handlers check what they need), and the body type flows
 * into the typed RPC client (`backend/src/client.ts`) as the request's `json`.
 */
export function jsonBody<T extends object>() {
  return validator("json", (value: Partial<T>) =>
    value && typeof value === "object" ? value : ({} as Partial<T>),
  );
}

/**
 * Declares the query-string keys a route reads (all optional strings), so the
 * typed RPC client accepts `{ query: { … } }`. Handlers keep using `c.req.query()`.
 */
export function queryParams<K extends string>() {
  // The client's `query` type is inferred from this return type.
  return validator("query", (value) => value as Partial<Record<K, string>>);
}
