import { Elysia } from "elysia";
import { ApiError, requireManager, verifyEmployeeInCompany } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { generateTempPassword, hashPassword } from "../lib/password";
import { serializeUser } from "../lib/serialize";

export const employeesRoutes = new Elysia({ prefix: "/employees" })
  .put("/", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { employeeId, designation } = body as {
        employeeId?: string;
        designation?: string | null;
      };

      if (!employeeId) {
        set.status = 400;
        return { error: "Missing employee ID" };
      }

      await verifyEmployeeInCompany(employeeId, user.companyId!);

      const updated = await prisma.user.update({
        where: { id: employeeId },
        data: { designation: designation || null },
      });

      return { employee: serializeUser(updated) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .delete("/", async ({ query, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const employeeId = query.id;

      if (!employeeId) {
        set.status = 400;
        return { error: "Missing employee ID" };
      }

      const employee = await prisma.user.findFirst({
        where: { id: employeeId, companyId: user.companyId! },
      });

      if (!employee) {
        set.status = 404;
        return { error: "Employee not found or access denied" };
      }

      if (employee.role === "owner") {
        set.status = 403;
        return { error: "Cannot remove company owner" };
      }

      await prisma.user.delete({ where: { id: employeeId } });

      return { message: "Employee removed successfully" };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/invite", async ({ body, headers, set }) => {
    try {
      const sender = await requireManager(headers.authorization ?? null);
      const { invites } = body as {
        invites?: Array<{
          email: string;
          fullName: string;
          designation?: string;
        }>;
      };

      if (!invites?.length) {
        set.status = 400;
        return { error: "At least one invitee is required." };
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
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) {
            inviteErrors.push(`${email}: Already exists`);
            continue;
          }

          const inviteCode = generateTempPassword();
          const passwordHash = await hashPassword(inviteCode);

          await prisma.user.create({
            data: {
              email,
              fullName,
              role: "employee",
              companyId: sender.companyId!,
              designation,
              passwordHash,
            },
          });

          created.push({ email, fullName, inviteCode });
          successCount++;
        } catch {
          inviteErrors.push(`${email}: Unexpected error processing invite`);
        }
      }

      if (successCount === 0) {
        set.status = 400;
        return {
          error: "Failed to invite any employees.",
          details: inviteErrors,
        };
      }

      return {
        message: `Successfully invited ${successCount} employee(s). Share their invite codes — email is not sent yet.`,
        invites: created,
        errors: inviteErrors.length > 0 ? inviteErrors : undefined,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "An unexpected error occurred" };
    }
  });
