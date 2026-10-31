import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { companies, shiftLogs, shifts } from "../db/schema";
import { readJson, requireManager } from "../lib/auth-guard";
import { serializeCompany } from "../lib/serialize";
import { logShiftAction } from "../lib/shift-log";
import { weekRangeFromStart } from "../lib/week-range";

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

export const companyRoutes = new Hono()
  .put("/", async (c) => {
    const user = await requireManager(c);
    const updates = await readJson<{
      morning_start: string;
      morning_end: string;
      evening_start: string;
      evening_end: string;
    }>(c);

    const [company] = await db
      .update(companies)
      .set({
        morningStart: updates.morning_start || "08:00",
        morningEnd: updates.morning_end || "16:00",
        eveningStart: updates.evening_start || "16:00",
        eveningEnd: updates.evening_end || "00:00",
      })
      .where(eq(companies.id, user.companyId))
      .returning();

    return c.json({ company: serializeCompany(company!) });
  })
  .post("/schedule/publish", async (c) => {
    const user = await requireManager(c);
    const { weekStart, from, to } = await readJson<{
      weekStart: string;
      from: string;
      to: string;
    }>(c);

    if (!weekStart) {
      return c.json({ error: "weekStart is required (YYYY-MM-DD)" }, 400);
    }

    let range: { start: Date; end: Date };
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && toDate && !Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      if (toDate <= fromDate) {
        return c.json({ error: "to must be after from" }, 400);
      }
      range = { start: fromDate, end: toDate };
    } else {
      try {
        range = weekRangeFromStart(weekStart);
      } catch {
        return c.json({ error: "Invalid weekStart date" }, 400);
      }
    }

    const published = await db
      .update(shifts)
      .set({ status: "published", publishedAt: new Date() })
      .where(
        and(
          eq(shifts.companyId, user.companyId),
          eq(shifts.status, "draft"),
          gte(shifts.startTime, range.start),
          lt(shifts.startTime, range.end),
        ),
      )
      .returning({ id: shifts.id });
    const count = published.length;

    if (count > 0) {
      await logShiftAction({
        companyId: user.companyId,
        actorId: user.id,
        action: "published",
        detail: `Published ${count} shift(s) for the week of ${weekStart}`,
        weekStart,
      });
    }

    return c.json({
      message: `Published ${count} shift(s) for the week of ${weekStart}`,
      publishedCount: count,
      weekStart,
    });
  })
  .get("/activity", async (c) => {
    const user = await requireManager(c);

    const logs = await db.query.shiftLogs.findMany({
      where: and(
        eq(shiftLogs.companyId, user.companyId),
        eq(shiftLogs.action, "published"),
      ),
      orderBy: desc(shiftLogs.createdAt),
      limit: 20,
      with: { actor: { columns: { fullName: true, role: true } } },
    });

    // Unique weekStarts only; all week lookups go out in one D1 batch.
    const weeks = [
      ...new Set(
        logs
          .map((log) => log.weekStart)
          .filter((value): value is string => Boolean(value)),
      ),
    ].flatMap((weekStart) => {
      try {
        return [{ weekStart, range: weekRangeFromStart(weekStart) }];
      } catch {
        return [];
      }
    });

    const shiftsByWeek = new Map<string, PublishedShift[]>();
    const queries = weeks.map(({ range }) =>
      db.query.shifts.findMany({
        where: and(
          eq(shifts.companyId, user.companyId),
          eq(shifts.status, "published"),
          gte(shifts.startTime, range.start),
          lt(shifts.startTime, range.end),
        ),
        with: { employee: { columns: { fullName: true } } },
        orderBy: asc(shifts.startTime),
      }),
    );
    const [first, ...rest] = queries;
    if (first) {
      const results = await db.batch([first, ...rest]);
      weeks.forEach(({ weekStart }, i) => shiftsByWeek.set(weekStart, results[i]!));
    }

    return c.json({
      activity: logs.map((log) =>
        serializeLog({
          ...log,
          publishedShifts: log.weekStart
            ? (shiftsByWeek.get(log.weekStart) ?? [])
            : [],
        }),
      ),
    });
  });
