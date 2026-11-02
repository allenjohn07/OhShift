import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { shifts, users } from "../db/schema";
import { isManagerRole, requireUser } from "../lib/auth-guard";
import { serializeShift, serializeUser } from "../lib/serialize";

const withEmployeeName = { employee: { columns: { fullName: true } } } as const;

export const dashboardRoutes = new Hono()
  .get("/employee", async (c) => {
    const user = await requireUser(c);

    if (isManagerRole(user.role)) {
      return c.json({ error: "Use company dashboard" }, 403);
    }

    if (!user.companyId) {
      return c.json({ error: "No company associated" }, 400);
    }

    const [myShifts, companyShifts] = await db.batch([
      db.query.shifts.findMany({
        where: and(eq(shifts.employeeId, user.id), eq(shifts.status, "published")),
        orderBy: asc(shifts.startTime),
      }),
      db.query.shifts.findMany({
        where: and(
          eq(shifts.companyId, user.companyId),
          eq(shifts.status, "published"),
        ),
        with: withEmployeeName,
        orderBy: asc(shifts.startTime),
      }),
    ]);

    return c.json({
      profile: serializeUser(user),
      shifts: myShifts.map((s) => serializeShift(s)),
      companyShifts: companyShifts.map((s) =>
        serializeShift({ ...s, users: { fullName: s.employee.fullName } }),
      ),
    });
  })
  .get("/company", async (c) => {
    const user = await requireUser(c);

    if (user.role === "employee") {
      return c.json({ error: "Employees use employee dashboard" }, 403);
    }

    if (!user.companyId) {
      return c.json({ error: "No company associated" }, 400);
    }

    const [employees, companyShifts, myShifts] = await db.batch([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          designation: users.designation,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.companyId, user.companyId),
            inArray(users.role, ["employee", "manager"]),
          ),
        )
        .orderBy(asc(users.fullName)),
      db.query.shifts.findMany({
        where: eq(shifts.companyId, user.companyId),
        with: withEmployeeName,
        orderBy: asc(shifts.startTime),
      }),
      // Manager's own published shifts (for their personal shift summary)
      db.query.shifts.findMany({
        where: and(eq(shifts.employeeId, user.id), eq(shifts.status, "published")),
        orderBy: asc(shifts.startTime),
      }),
    ]);

    return c.json({
      profile: serializeUser(user),
      employees: employees.map((e) => ({
        id: e.id,
        full_name: e.fullName,
        email: e.email,
        designation: e.designation,
        // The query only selects these two roles.
        role: e.role as "employee" | "manager",
      })),
      shifts: companyShifts.map((s) =>
        serializeShift({ ...s, users: { fullName: s.employee.fullName } }),
      ),
      myShifts: myShifts.map((s) => serializeShift(s)),
    });
  })
  .get("/profile", async (c) => {
    const user = await requireUser(c);
    return c.json({ profile: serializeUser(user) });
  });
