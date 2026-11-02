import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { timeEntries, users, type UserRole } from "../db/schema";
import {
  assertOwner,
  jsonBody,
  requireManager,
  verifyEmployeeInCompany,
  queryParams,
} from "../lib/auth-guard";
import { generateTempPassword, hashPassword } from "../lib/password";
import { serializeUser } from "../lib/serialize";

const ASSIGNABLE_ROLES: UserRole[] = ["employee", "manager"];

type UpdateEmployeeBody = {
  employeeId: string;
  designation: string | null;
  role: UserRole;
};

type InviteBody = {
  invites: Array<{
    email: string;
    fullName: string;
    designation?: string;
  }>;
};

export const employeesRoutes = new Hono()
  .put("/", jsonBody<UpdateEmployeeBody>(), async (c) => {
    const user = await requireManager(c);
    const { employeeId, designation, role } = c.req.valid("json");

    if (!employeeId) {
      return c.json({ error: "Missing employee ID" }, 400);
    }

    const member = await verifyEmployeeInCompany(employeeId, user.companyId);

    if (member.role === "owner") {
      return c.json({ error: "Cannot change the company owner's role" }, 403);
    }

    if (role !== undefined) {
      assertOwner(user);

      if (!ASSIGNABLE_ROLES.includes(role)) {
        return c.json({ error: "Role must be employee or manager" }, 400);
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(designation !== undefined
          ? { designation: designation || null }
          : {}),
        ...(role !== undefined ? { role } : {}),
      })
      .where(eq(users.id, employeeId))
      .returning();

    return c.json({ employee: serializeUser(updated!) });
  })
  .delete("/", queryParams<"id">(), async (c) => {
    const user = await requireManager(c);
    const employeeId = c.req.query("id");

    if (!employeeId) {
      return c.json({ error: "Missing employee ID" }, 400);
    }

    const employee = await db.query.users.findFirst({
      where: and(eq(users.id, employeeId), eq(users.companyId, user.companyId)),
    });

    if (!employee) {
      return c.json({ error: "Employee not found or access denied" }, 404);
    }

    if (employee.role === "owner") {
      return c.json({ error: "Cannot remove company owner" }, 403);
    }

    if (employee.role === "manager") {
      assertOwner(user);
    }

    const open = await db.query.timeEntries.findFirst({ where: and(eq(timeEntries.employeeId, employeeId), eq(timeEntries.status, "open")), columns: { id: true } });
    if (open) return c.json({ error: "This employee must clock out before being deactivated." }, 409);
    await db.update(users).set({ isActive: false }).where(and(eq(users.id, employeeId), eq(users.companyId, user.companyId)));
    return c.json({ message: "Employee deactivated. Historical shifts and timesheets are preserved." });
  })
  .post("/invite", jsonBody<InviteBody>(), async (c) => {
    const sender = await requireManager(c);
    const { invites } = c.req.valid("json");

    if (!invites?.length) {
      return c.json({ error: "At least one invitee is required." }, 400);
    }

    let successCount = 0;
    const inviteErrors: string[] = [];
    const created: Array<{ email: string; fullName: string; inviteCode: string }> =
      [];

    for (const invite of invites) {
      const email = invite.email.trim();
      const fullName = invite.fullName.trim();
      const designation = invite.designation?.trim() || null;

      try {
        const inviteCode = generateTempPassword();
        const passwordHash = await hashPassword(inviteCode);

        // Unique email: skip silently-conflicting rows instead of a pre-check query.
        const inserted = await db
          .insert(users)
          .values({
            email,
            fullName,
            role: "employee",
            companyId: sender.companyId,
            designation,
            passwordHash,
          })
          .onConflictDoNothing({ target: users.email })
          .returning({ id: users.id });

        if (inserted.length === 0) {
          inviteErrors.push(
            `${email}: already registered — use a different email`,
          );
          continue;
        }

        created.push({ email, fullName, inviteCode });
        successCount++;
      } catch (err) {
        console.error("Invite failed for", email, err);
        const reason =
          err instanceof Error ? err.message : "Unexpected error";
        inviteErrors.push(`${email}: ${reason}`);
      }
    }

    if (successCount === 0) {
      return c.json(
        {
          error: "Failed to invite any employees.",
          details: inviteErrors,
        },
        400,
      );
    }

    return c.json({
      message: `Successfully invited ${successCount} employee(s). Share their invite codes — email is not sent yet.`,
      invites: created,
      errors: inviteErrors.length > 0 ? inviteErrors : undefined,
    });
  });
