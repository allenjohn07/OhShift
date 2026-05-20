import { Elysia } from "elysia";
import {
  ApiError,
  requireManager,
  requireUser,
  verifyEmployeeInCompany,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { appUrl, mailConfigured, sendMail } from "../lib/mail";
import { serializeShift } from "../lib/serialize";

function formatShiftTimes(startTime: string, endTime: string, timezone: string) {
  const formattedStart = new Date(startTime).toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const formattedEnd = new Date(endTime).toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return { formattedStart, formattedEnd };
}

async function getEmployeeEmailData(employeeId: string) {
  return prisma.user.findUnique({
    where: { id: employeeId },
    include: { company: true },
  });
}

export const shiftsRoutes = new Elysia({ prefix: "/shifts" })
  .get("/mine", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const shifts = await prisma.shift.findMany({
        where: { employeeId: user.id },
        orderBy: { startTime: "asc" },
      });
      return { shifts: shifts.map(serializeShift) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { employeeId, title, startTime, endTime, timezone = "UTC" } =
        body as {
          employeeId?: string;
          title?: string;
          startTime?: string;
          endTime?: string;
          timezone?: string;
        };

      if (!employeeId || !title || !startTime || !endTime) {
        set.status = 400;
        return { error: "Missing required fields" };
      }

      await verifyEmployeeInCompany(employeeId, user.companyId!);

      const shift = await prisma.shift.create({
        data: {
          companyId: user.companyId!,
          employeeId,
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
      });

      if (mailConfigured()) {
        const employeeData = await getEmployeeEmailData(employeeId);
        if (employeeData?.email) {
          const companyName = employeeData.company?.name || "your company";
          const { formattedStart, formattedEnd } = formatShiftTimes(
            startTime,
            endTime,
            timezone,
          );

          try {
            await sendMail({
              to: employeeData.email,
              subject: `New Shift Assigned: ${title}`,
              html: `
                <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
                  <h2 style="color: #333; font-size: 20px; font-weight: bold;">New Shift Assigned</h2>
                  <p style="color: #555; margin-top: 16px;">Hi ${employeeData.fullName || "there"},</p>
                  <p style="color: #555; margin-top: 8px;">You have been assigned a new shift at <strong>${companyName}</strong>.</p>
                  <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 8px;">
                    <p style="margin: 0; color: #0f172a; font-weight: bold; font-size: 16px;">${title}</p>
                    <p style="margin: 8px 0 0; color: #475569; font-size: 15px;">🗓 ${formattedStart} - ${formattedEnd}</p>
                  </div>
                  <div style="margin-top: 32px;">
                    <a href="${appUrl()}/dashboard" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                      View Your Schedule
                    </a>
                  </div>
                </div>
              `,
            });
          } catch (emailError) {
            console.error("Failed to send shift assignment email:", emailError);
          }
        }
      }

      return { shift: serializeShift(shift) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .put("/", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { shiftId, title, startTime, endTime } = body as {
        shiftId?: string;
        title?: string;
        startTime?: string;
        endTime?: string;
      };

      if (!shiftId || !title || !startTime || !endTime) {
        set.status = 400;
        return { error: "Missing required fields" };
      }

      const existing = await prisma.shift.findFirst({
        where: { id: shiftId, companyId: user.companyId! },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Shift not found or access denied" };
      }

      const shift = await prisma.shift.update({
        where: { id: shiftId },
        data: {
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
      });

      return { shift: serializeShift(shift) };
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
      const shiftId = query.id;
      const timezone = query.timezone || "UTC";

      if (!shiftId) {
        set.status = 400;
        return { error: "Missing shift ID" };
      }

      const existing = await prisma.shift.findFirst({
        where: { id: shiftId, companyId: user.companyId! },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Shift not found or access denied" };
      }

      await prisma.shift.delete({ where: { id: shiftId } });

      if (mailConfigured()) {
        const employeeData = await getEmployeeEmailData(existing.employeeId);
        if (employeeData?.email) {
          const companyName = employeeData.company?.name || "your company";
          const { formattedStart, formattedEnd } = formatShiftTimes(
            existing.startTime.toISOString(),
            existing.endTime.toISOString(),
            timezone,
          );

          try {
            await sendMail({
              to: employeeData.email,
              subject: `Shift Cancelled: ${existing.title}`,
              html: `
                <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
                  <h2 style="color: #dc2626; font-size: 20px; font-weight: bold;">Shift Cancelled</h2>
                  <p style="color: #555; margin-top: 16px;">Hi ${employeeData.fullName || "there"},</p>
                  <p style="color: #555; margin-top: 8px;">A shift previously assigned to you at <strong>${companyName}</strong> has been cancelled.</p>
                  <div style="margin-top: 24px; padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                    <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 16px;"><span style="text-decoration: line-through;">${existing.title}</span></p>
                    <p style="margin: 8px 0 0; color: #475569; font-size: 15px;">🗓 ${formattedStart} - ${formattedEnd}</p>
                  </div>
                  <div style="margin-top: 32px;">
                    <a href="${appUrl()}/dashboard" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                      View Your Updated Schedule
                    </a>
                  </div>
                </div>
              `,
            });
          } catch (emailError) {
            console.error("Failed to send shift cancellation email:", emailError);
          }
        }
      }

      return { message: "Shift deleted successfully" };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
