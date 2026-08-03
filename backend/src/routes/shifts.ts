import { Elysia } from "elysia";
import {
  ApiError,
  requireManager,
  requireUser,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { serializeShift } from "../lib/serialize";
import {
  createDraftShift,
  evaluateEligibility,
  validateShiftAssignment,
} from "../lib/shift-create";
import { logShiftAction } from "../lib/shift-log";

const BULK_MAX = 50;

export const shiftsRoutes = new Elysia({ prefix: "/shifts" })
  .get("/mine", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const shifts = await prisma.shift.findMany({
        where: {
          employeeId: user.id,
          status: "published",
        },
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
  .get("/eligible", async ({ headers, query, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const startRaw = typeof query.start === "string" ? query.start : "";
      const endRaw = typeof query.end === "string" ? query.end : "";
      const timezone =
        typeof query.timezone === "string" && query.timezone.trim()
          ? query.timezone.trim()
          : undefined;
      const designationFilter =
        typeof query.designation === "string" && query.designation.trim()
          ? query.designation.trim()
          : null;

      if (!startRaw || !endRaw) {
        set.status = 400;
        return { error: "start and end are required" };
      }

      const start = new Date(startRaw);
      const end = new Date(endRaw);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        set.status = 400;
        return { error: "Invalid start or end time" };
      }
      if (start >= end) {
        set.status = 400;
        return { error: "End time must be after start time" };
      }

      const members = await prisma.user.findMany({
        where: {
          companyId: user.companyId!,
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

      const people = await Promise.all(
        members.map(async (m) => {
          const { eligible, reason } = await evaluateEligibility({
            employeeId: m.id,
            designation: m.designation,
            filterDesignation: designationFilter,
            start,
            end,
            timezone,
          });
          return {
            id: m.id,
            full_name: m.fullName,
            email: m.email,
            designation: m.designation,
            role: m.role,
            eligible,
            reason,
          };
        }),
      );

      const designations = [
        ...new Set(
          members
            .map((m) => m.designation?.trim())
            .filter((d): d is string => Boolean(d)),
        ),
      ].sort((a, b) => a.localeCompare(b));

      return { people, designations };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      console.error(err);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/bulk", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { timezone, shifts } = body as {
        timezone?: string;
        shifts?: Array<{
          employeeId?: string;
          title?: string;
          startTime?: string;
          endTime?: string;
        }>;
      };

      if (!Array.isArray(shifts) || shifts.length === 0) {
        set.status = 400;
        return { error: "shifts array is required" };
      }
      if (shifts.length > BULK_MAX) {
        set.status = 400;
        return { error: `At most ${BULK_MAX} shifts per request` };
      }

      const results: Array<{
        employee_id: string;
        ok: boolean;
        shift?: ReturnType<typeof serializeShift>;
        error?: string;
      }> = [];

      let created = 0;
      let failed = 0;

      for (const item of shifts) {
        const employeeId = item.employeeId?.trim() ?? "";
        const title = item.title?.trim() ?? "";
        if (!employeeId || !title || !item.startTime || !item.endTime) {
          results.push({
            employee_id: employeeId || "unknown",
            ok: false,
            error: "Missing required fields",
          });
          failed += 1;
          continue;
        }

        const start = new Date(item.startTime);
        const end = new Date(item.endTime);
        const outcome = await createDraftShift({
          companyId: user.companyId!,
          actorId: user.id,
          employeeId,
          title,
          start,
          end,
          timezone,
        });

        if (outcome.ok) {
          created += 1;
          results.push({
            employee_id: employeeId,
            ok: true,
            shift: outcome.shift,
          });
        } else {
          failed += 1;
          results.push({
            employee_id: employeeId,
            ok: false,
            error: outcome.error,
          });
        }
      }

      return { created, failed, results };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      console.error(err);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { employeeId, title, startTime, endTime, timezone } = body as {
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

      const outcome = await createDraftShift({
        companyId: user.companyId!,
        actorId: user.id,
        employeeId,
        title,
        start: new Date(startTime),
        end: new Date(endTime),
        timezone,
      });

      if (!outcome.ok) {
        set.status = outcome.status;
        return { error: outcome.error };
      }

      return { shift: outcome.shift };
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
      const { shiftId, title, startTime, endTime, timezone } = body as {
        shiftId?: string;
        title?: string;
        startTime?: string;
        endTime?: string;
        timezone?: string;
      };

      if (!shiftId || !title || !startTime || !endTime) {
        set.status = 400;
        return { error: "Missing required fields" };
      }

      const existing = await prisma.shift.findFirst({
        where: { id: shiftId, companyId: user.companyId! },
        include: { employee: { select: { fullName: true } } },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Shift not found or access denied" };
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      const validationError = await validateShiftAssignment({
        employeeId: existing.employeeId,
        start,
        end,
        timezone,
        excludeShiftId: shiftId,
      });
      if (validationError) {
        set.status = validationError.status;
        return { error: validationError.error };
      }

      const shift = await prisma.shift.update({
        where: { id: shiftId },
        data: { title, startTime: start, endTime: end },
      });

      await logShiftAction({
        companyId: user.companyId!,
        actorId: user.id,
        action: "updated",
        shiftId: shift.id,
        detail: `Updated "${title}" for ${existing.employee.fullName} on ${start.toDateString()}`,
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

      if (!shiftId) {
        set.status = 400;
        return { error: "Missing shift ID" };
      }

      const existing = await prisma.shift.findFirst({
        where: { id: shiftId, companyId: user.companyId! },
        include: { employee: { select: { fullName: true } } },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Shift not found or access denied" };
      }

      await prisma.shift.delete({ where: { id: shiftId } });

      await logShiftAction({
        companyId: user.companyId!,
        actorId: user.id,
        action: "deleted",
        shiftId: null,
        detail: `Deleted "${existing.title}" for ${existing.employee.fullName} on ${existing.startTime.toDateString()}`,
      });

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
