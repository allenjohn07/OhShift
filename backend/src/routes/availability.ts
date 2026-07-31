import { Elysia } from "elysia";
import { ApiError, requireUser } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const; // Mon–Sun

function isHhMm(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function serializeWindow(row: {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}) {
  return {
    day_of_week: row.dayOfWeek,
    is_available: row.isAvailable,
    start_time: row.startTime,
    end_time: row.endTime,
  };
}

function defaultWeek(morningStart?: string, morningEnd?: string) {
  const start = morningStart && isHhMm(morningStart) ? morningStart : "09:00";
  const end = morningEnd && isHhMm(morningEnd) ? morningEnd : "17:00";
  return DAYS.map((dayOfWeek) => ({
    day_of_week: dayOfWeek,
    is_available: true,
    start_time: start,
    end_time: end,
  }));
}

export const availabilityRoutes = new Elysia({ prefix: "/availability" })
  .get("/", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      const rows = await prisma.availabilityWindow.findMany({
        where: { userId: user.id },
        orderBy: { dayOfWeek: "asc" },
      });

      if (rows.length === 0) {
        const company = user.companyId
          ? await prisma.company.findUnique({ where: { id: user.companyId } })
          : null;
        return {
          days: defaultWeek(company?.morningStart, company?.morningEnd),
        };
      }

      const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
      const company = user.companyId
        ? await prisma.company.findUnique({ where: { id: user.companyId } })
        : null;
      const fallback = defaultWeek(company?.morningStart, company?.morningEnd);

      return {
        days: DAYS.map((day) => {
          const row = byDay.get(day);
          return row
            ? serializeWindow(row)
            : fallback[day]!;
        }),
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
  .put("/", async ({ headers, set, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      const payload = body as {
        days?: Array<{
          day_of_week: number;
          is_available: boolean;
          start_time: string;
          end_time: string;
        }>;
      };

      if (!payload?.days || !Array.isArray(payload.days) || payload.days.length !== 7) {
        set.status = 400;
        return { error: "Expected days array with 7 entries (Mon–Sun)" };
      }

      const seen = new Set<number>();
      const normalized = [];

      for (const day of payload.days) {
        const dow = day.day_of_week;
        if (!Number.isInteger(dow) || dow < 0 || dow > 6 || seen.has(dow)) {
          set.status = 400;
          return { error: "Each day_of_week must be unique and between 0–6" };
        }
        seen.add(dow);

        const isAvailable = Boolean(day.is_available);
        const startTime = String(day.start_time || "09:00");
        const endTime = String(day.end_time || "17:00");

        if (!isHhMm(startTime) || !isHhMm(endTime)) {
          set.status = 400;
          return { error: "Times must be HH:mm (24h)" };
        }

        if (isAvailable && toMinutes(endTime) <= toMinutes(startTime)) {
          set.status = 400;
          return { error: "End time must be after start time (same day)" };
        }

        normalized.push({
          userId: user.id,
          dayOfWeek: dow,
          isAvailable,
          startTime,
          endTime,
        });
      }

      if (seen.size !== 7) {
        set.status = 400;
        return { error: "Must include all days 0–6" };
      }

      await prisma.$transaction([
        prisma.availabilityWindow.deleteMany({ where: { userId: user.id } }),
        prisma.availabilityWindow.createMany({ data: normalized }),
      ]);

      const rows = await prisma.availabilityWindow.findMany({
        where: { userId: user.id },
        orderBy: { dayOfWeek: "asc" },
      });

      return { days: rows.map(serializeWindow) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
