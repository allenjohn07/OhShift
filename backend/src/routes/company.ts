import { Elysia } from "elysia";
import { ApiError, requireManager } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";
import { serializeCompany } from "../lib/serialize";
import { weekRangeFromStart } from "../lib/week-range";
import { logShiftAction } from "../lib/shift-log";

type PublishedShift = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  employee: { fullName: string };
};

function serializeLog(
  log: {
    id: string;
    action: string;
    detail: string;
    createdAt: Date;
    weekStart: string | null;
    actor: { fullName: string; role: string };
    publishedShifts?: PublishedShift[];
  },
) {
  return {
    id: log.id,
    action: log.action,
    detail: log.detail,
    week_start: log.weekStart,
    created_at: log.createdAt.toISOString(),
    actor: {
      full_name: log.actor.fullName,
      role: log.actor.role,
    },
    shifts: (log.publishedShifts ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      employee_name: s.employee.fullName,
      start_time: s.startTime.toISOString(),
      end_time: s.endTime.toISOString(),
    })),
  };
}

export const companyRoutes = new Elysia({ prefix: "/company" })
  .put("/", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const updates = body as {
        morning_start?: string;
        morning_end?: string;
        evening_start?: string;
        evening_end?: string;
      };

      const company = await prisma.company.update({
        where: { id: user.companyId! },
        data: {
          morningStart: updates.morning_start || "08:00",
          morningEnd: updates.morning_end || "16:00",
          eveningStart: updates.evening_start || "16:00",
          eveningEnd: updates.evening_end || "00:00",
        },
      });

      return { company: serializeCompany(company) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/schedule/publish", async ({ body, headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const { weekStart } = body as { weekStart?: string };

      if (!weekStart) {
        set.status = 400;
        return { error: "weekStart is required (YYYY-MM-DD)" };
      }

      let range: { start: Date; end: Date };
      try {
        range = weekRangeFromStart(weekStart);
      } catch {
        set.status = 400;
        return { error: "Invalid weekStart date" };
      }

      const now = new Date();
      const result = await prisma.shift.updateMany({
        where: {
          companyId: user.companyId!,
          status: "draft",
          startTime: { gte: range.start, lt: range.end },
        },
        data: {
          status: "published",
          publishedAt: now,
        },
      });

      if (result.count > 0) {
        await logShiftAction({
          companyId: user.companyId!,
          actorId: user.id,
          action: "published",
          detail: `Published ${result.count} shift(s) for the week of ${weekStart}`,
          weekStart,
        });
      }

      return {
        message: `Published ${result.count} shift(s) for the week of ${weekStart}`,
        publishedCount: result.count,
        weekStart,
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
  .get("/activity", async ({ headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);

      const logs = await prisma.shiftLog.findMany({
        where: { companyId: user.companyId!, action: "published" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          actor: { select: { fullName: true, role: true } },
        },
      });

      // For each publish log fetch shifts for that week using weekStart
      const logsWithShifts = await Promise.all(
        logs.map(async (log) => {
          if (!log.weekStart) return { ...log, publishedShifts: [] };

          let range: { start: Date; end: Date };
          try {
            range = weekRangeFromStart(log.weekStart);
          } catch {
            return { ...log, publishedShifts: [] };
          }

          const shifts = await prisma.shift.findMany({
            where: {
              companyId: user.companyId!,
              status: "published",
              startTime: { gte: range.start, lt: range.end },
            },
            include: { employee: { select: { fullName: true } } },
            orderBy: { startTime: "asc" },
          });

          return { ...log, publishedShifts: shifts };
        }),
      );

      return { activity: logsWithShifts.map(serializeLog) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
