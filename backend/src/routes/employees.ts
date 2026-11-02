import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { users, type UserRole } from "../db/schema";
import {
  assertOwner,
  jsonBody,
  requireManager,
  verifyEmployeeInCompany,
  queryParams,
} from "../lib/auth-guard";
import { sendAccountLink } from "../lib/account-tokens";
import { emailConfig } from "../lib/email";
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

    await db.delete(users).where(eq(users.id, employeeId));

    return c.json({ message: "Employee removed successfully" });
  })
  .post("/invite", jsonBody<InviteBody>(), async (c) => {
    const sender = await requireManager(c);
    const { invites } = c.req.valid("json");

    if (!Array.isArray(invites) || invites.length < 1 || invites.length > 20 || invites.some(i => !i || typeof i.email !== "string" || i.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim()) || typeof i.fullName !== "string" || !i.fullName.trim() || i.fullName.length > 120 || (i.designation !== undefined && (typeof i.designation !== "string" || i.designation.length > 120)))) {
      return c.json({ error: "Provide 1–20 valid invitations with names and email addresses." }, 400);
    }
    try { emailConfig(); } catch { return c.json({ error: "Email delivery is not configured. Contact your administrator." }, 503); }
    const created: Array<{ email: string; fullName: string }> = [];
    const inviteErrors: string[] = [];
    for (const invite of invites) {
      const email = invite.email.trim().toLowerCase();
      const fullName = invite.fullName.trim();
      try {
        let member = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` });
        if (member && (member.companyId !== sender.companyId || member.passwordHash !== null)) {
          inviteErrors.push(`${email}: already registered`);
          continue;
        }
        if (!member) {
          const [inserted] = await db.insert(users).values({ email, fullName, role: "employee", companyId: sender.companyId, designation: invite.designation?.trim() || null, passwordHash: null }).onConflictDoNothing({ target: users.email }).returning();
          member = inserted;
        }
        if (!member) { inviteErrors.push(`${email}: already registered`); continue; }
        await sendAccountLink(member, "invite", sender.company?.name);
        created.push({ email, fullName });
      } catch {
        console.error("Invitation delivery failed");
        inviteErrors.push(`${email}: delivery failed; try inviting this address again`);
      }
    }
    if (!created.length) return c.json({ error: "No invitations could be sent.", details: inviteErrors }, 400);
    return c.json({ message: `Sent ${created.length} invitation(s).`, invites: created, errors: inviteErrors.length ? inviteErrors : undefined });
  });
