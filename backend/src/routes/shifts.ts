import { Elysia } from "elysia";
import {
  ApiError,
  requireManager,
  requireUser,
  verifyEmployeeInCompany,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { serializeShift } from "../lib/serialize";
import {
  findOverlappingShifts,
  formatConflictMessage,
} from "../lib/shift-conflicts";
import { logShiftAction } from "../lib/shift-log";

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
  .post("/", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { employeeId, title, startTime, endTime } = body as {
        employeeId?: string;
        title?: string;
        startTime?: string;
        endTime?: string;
      };

      if (!employeeId || !title || !startTime || !endTime) {
        set.status = 400;
        return { error: "Missing required fields" };
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        set.status = 400;
        return { error: "Invalid start or end time" };
      }

      if (start >= end) {
        set.status = 400;
        return { error: "End time must be after start time" };
      }

      const employee = await verifyEmployeeInCompany(employeeId, user.companyId!);

      const conflicts = await findOverlappingShifts(employeeId, start, end);
      if (conflicts.length > 0) {
        set.status = 409;
        return {
          error: formatConflictMessage(conflicts),
          conflicts: conflicts.map((c) => serializeShift(c)),
        };
      }

      const shift = await prisma.shift.create({
        data: {
          companyId: user.companyId!,
          employeeId,
          title,
          startTime: start,
          endTime: end,
          status: "draft",
        },
      });

      await logShiftAction({
        companyId: user.companyId!,
        actorId: user.id,
        action: "created",
        shiftId: shift.id,
        detail: `Assigned "${title}" to ${employee.fullName} on ${start.toDateString()}`,
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
        include: { employee: { select: { fullName: true } } },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Shift not found or access denied" };
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        set.status = 400;
        return { error: "Invalid start or end time" };
      }

      if (start >= end) {
        set.status = 400;
        return { error: "End time must be after start time" };
      }

      const conflicts = await findOverlappingShifts(
        existing.employeeId,
        start,
        end,
        shiftId,
      );
      if (conflicts.length > 0) {
        set.status = 409;
        return {
          error: formatConflictMessage(conflicts),
          conflicts: conflicts.map((c) => serializeShift(c)),
        };
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
