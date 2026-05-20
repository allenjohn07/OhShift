import { prisma } from "./prisma";
import { getAuthFromBearer, getDbUser } from "./session";
import type { UserRole } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(authorization: string | null) {
  const payload = await getAuthFromBearer(authorization);
  if (!payload?.sub) {
    throw new ApiError("Unauthorized", 401);
  }

  const user = await getDbUser(payload.sub);
  if (!user) {
    throw new ApiError("Unauthorized", 401);
  }

  return user;
}

export async function requireManager(authorization: string | null) {
  const user = await requireUser(authorization);
  if (user.role !== "owner" && user.role !== "manager") {
    throw new ApiError("Forbidden", 403);
  }
  if (!user.companyId) {
    throw new ApiError("No company associated with user", 400);
  }
  return user;
}

export function isManagerRole(role: UserRole) {
  return role === "owner" || role === "manager";
}

export async function verifyEmployeeInCompany(
  employeeId: string,
  companyId: string,
) {
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId },
  });
  if (!employee) {
    throw new ApiError("Invalid employee", 400);
  }
  return employee;
}
