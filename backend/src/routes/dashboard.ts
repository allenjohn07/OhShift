import { Elysia } from "elysia";
import { ApiError, isManagerRole, requireUser } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { serializeShift, serializeUser } from "../lib/serialize";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" })
  .get("/employee", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      if (isManagerRole(user.role)) {
        set.status = 403;
        return { error: "Use company dashboard" };
      }

      if (!user.companyId) {
        set.status = 400;
        return { error: "No company associated" };
      }

      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        include: { company: true },
      });

      const shifts = await prisma.shift.findMany({
        where: { employeeId: user.id, status: "published" },
        orderBy: { startTime: "asc" },
      });

      const companyShifts = await prisma.shift.findMany({
        where: { companyId: user.companyId, status: "published" },
        include: { employee: { select: { fullName: true } } },
        orderBy: { startTime: "asc" },
      });

      return {
        profile: serializeUser(profile!),
        shifts: shifts.map(serializeShift),
        companyShifts: companyShifts.map((s) =>
          serializeShift({ ...s, users: { fullName: s.employee.fullName } }),
        ),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .get("/company", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      if (user.role === "employee") {
        set.status = 403;
        return { error: "Employees use employee dashboard" };
      }

      if (!user.companyId) {
        set.status = 400;
        return { error: "No company associated" };
      }

      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        include: { company: true },
      });

      const employees = await prisma.user.findMany({
        where: {
          companyId: user.companyId,
          role: { in: ["employee", "manager"] },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          designation: true,
          role: true,
        },
        orderBy: { fullName: "asc" },
      });

      const shifts = await prisma.shift.findMany({
        where: { companyId: user.companyId },
        include: { employee: { select: { fullName: true } } },
        orderBy: { startTime: "asc" },
      });

      // Manager's own published shifts (for their personal shift summary)
      const myShifts = await prisma.shift.findMany({
        where: { employeeId: user.id, status: "published" },
        orderBy: { startTime: "asc" },
      });

      return {
        profile: serializeUser(profile!),
        employees: employees.map((e) => ({
          id: e.id,
          full_name: e.fullName,
          email: e.email,
          designation: e.designation,
          role: e.role,
        })),
        shifts: shifts.map((s) =>
          serializeShift({ ...s, users: { fullName: s.employee.fullName } }),
        ),
        myShifts: myShifts.map(serializeShift),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .get("/profile", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        include: { company: true },
      });

      return { profile: serializeUser(profile!) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
