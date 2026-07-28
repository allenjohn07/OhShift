import { Elysia } from "elysia";
import {
  ApiError,
  requireManager,
  requireUser,
  verifyEmployeeInCompany,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { serializeShift } from "../lib/serialize";

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
