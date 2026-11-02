import * as v from "../lib/validation";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { availabilityWindows } from "../db/schema";
import { jsonBody, requireUser } from "../lib/auth-guard";

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

type AvailabilityBody = {
  days: Array<{
    day_of_week: number;
    is_available: boolean;
    start_time: string;
    end_time: string;
  }>;
};

export const availabilityRoutes = new Hono()
  .get("/", async (c) => {
    const user = await requireUser(c);

    const rows = await db.query.availabilityWindows.findMany({
      where: eq(availabilityWindows.userId, user.id),
      orderBy: asc(availabilityWindows.dayOfWeek),
    });

    const fallback = defaultWeek(
      user.company?.morningStart,
      user.company?.morningEnd,
    );
    if (rows.length === 0) {
      return c.json({ days: fallback });
    }

    const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
    return c.json({
      days: DAYS.map((day) => {
        const row = byDay.get(day);
        return row ? serializeWindow(row) : fallback[day]!;
      }),
    });
  })
  .put("/", jsonBody<AvailabilityBody>({ days: v.array(v.object({ day_of_week: v.integer(0, 6), is_available: v.boolean, start_time: v.time, end_time: v.time }, ["day_of_week", "is_available", "start_time", "end_time"]), 7, 7) }), async (c) => {
    const user = await requireUser(c);

    const payload = c.req.valid("json");

    if (!payload.days || !Array.isArray(payload.days) || payload.days.length !== 7) {
      return c.json({ error: "Expected days array with 7 entries (Mon–Sun)" }, 400);
    }

    const seen = new Set<number>();
    const normalized = [];

    for (const day of payload.days) {
      const dow = day.day_of_week;
      if (!Number.isInteger(dow) || dow < 0 || dow > 6 || seen.has(dow)) {
        return c.json({ error: "Each day_of_week must be unique and between 0–6" }, 400);
      }
      seen.add(dow);

      const isAvailable = Boolean(day.is_available);
      const startTime = String(day.start_time || "09:00");
      const endTime = String(day.end_time || "17:00");

      if (!isHhMm(startTime) || !isHhMm(endTime)) {
        return c.json({ error: "Times must be HH:mm (24h)" }, 400);
      }

      // End before start = overnight window (e.g. 20:00–04:00 for night shifts).
      if (isAvailable && toMinutes(endTime) === toMinutes(startTime)) {
        return c.json({ error: "Start and end time can't be the same" }, 400);
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
      return c.json({ error: "Must include all days 0–6" }, 400);
    }

    await db.batch([
      db.delete(availabilityWindows).where(eq(availabilityWindows.userId, user.id)),
      db.insert(availabilityWindows).values(normalized),
    ]);

    normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    return c.json({ days: normalized.map(serializeWindow) });
  });
