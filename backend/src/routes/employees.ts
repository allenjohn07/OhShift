import { Elysia } from "elysia";
import { ApiError, requireManager, verifyEmployeeInCompany } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { generateTempPassword, hashPassword } from "../lib/password";
import { appUrl, mailConfigured, sendMail } from "../lib/mail";
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

      if (!mailConfigured()) {
        set.status = 500;
        return {
          error: "SMTP_EMAIL or SMTP_PASSWORD is not configured on the server.",
        };
      }

      const company = await prisma.company.findUnique({
        where: { id: sender.companyId! },
      });
      const companyName = company?.name || "the company";

      let successCount = 0;
      const inviteErrors: string[] = [];

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

          try {
            await sendMail({
              to: email,
              subject: `You've been invited to join ${companyName} on OhShift`,
              html: `
              <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <h2 style="color: #333 text-xl font-bold">Welcome to OhShift!</h2>
                <p style="color: #555 mt-4">Hi ${fullName},</p>
                <p style="color: #555 mt-2">You have been invited by <strong>${sender.fullName}</strong> to join the team at <strong>${companyName}</strong> on OhShift.</p>
                <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 8px;">
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Your secure invitation code (password):</p>
                  <p style="margin: 8px 0 0; font-size: 24px; font-weight: bold; font-family: monospace; color: #0f172a; letter-spacing: 2px;">
                    ${inviteCode}
                  </p>
                </div>
                <p style="color: #555 mt-6">Use this email address along with the invitation code above to log in to your employee portal.</p>
                <div style="margin-top: 32px;">
                  <a href="${appUrl()}/login" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                    Log in to your account
                  </a>
                </div>
              </div>
            `,
            });
          } catch {
            inviteErrors.push(`${email}: User created, but email invite failed to send.`);
          }

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
        message: `Successfully invited ${successCount} employee(s).`,
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
