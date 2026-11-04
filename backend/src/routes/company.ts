import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import * as v from "../lib/validation";
import { Hono } from "hono";
import { db } from "../db";
import { companies, emailJobs, shiftLogs, shifts } from "../db/schema";
import { jsonBody, requireManager } from "../lib/auth-guard";
import { isDemoUser } from "../lib/demo";
import { serializeCompany } from "../lib/serialize";
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

type PresetsBody = {
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
};

type PublishBody = {
  weekStart: string;
  from: string;
  to: string;
};

export const companyRoutes = new Hono()
  .put("/", jsonBody<PresetsBody>({ morning_start: v.time, morning_end: v.time, evening_start: v.time, evening_end: v.time }), async (c) => {
    const user = await requireManager(c);
    const updates = c.req.valid("json");
    if ([updates.morning_start, updates.morning_end, updates.evening_start, updates.evening_end].some(value => value === undefined)) {
      return c.json({ error: "Provide all four shift preset times." }, 400);
    }

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
  .post("/schedule/publish", jsonBody<PublishBody>({ weekStart: v.dateOnly, from: v.instant, to: v.instant }), async (c) => {
    const user = await requireManager(c);
    const { weekStart, from, to } = c.req.valid("json");

    if (!weekStart) {
      return c.json({ error: "weekStart is required (YYYY-MM-DD)" }, 400);
    }

    if (Boolean(from) !== Boolean(to)) return c.json({ error: "Provide both from and to, or neither." }, 400);
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

    const eventId = crypto.randomUUID();
    const now = new Date();
    const drafts = and(eq(shifts.companyId, user.companyId), eq(shifts.status, "draft"), gte(shifts.startTime, range.start), lt(shifts.startTime, range.end));
    // Query builders, not db.run(sql): Drizzle's D1 batch can't bind raw
    // statements that have parameters. Each select lists every column of its
    // target table in schema order (Drizzle checks this at runtime).
    // The outbox/log select only drafts; a competing publish sees zero after
    // this batch commits, so it cannot enqueue duplicate notifications.
    const outbox = db.insert(emailJobs).select(
      db.select({
        id: sql<string>`${eventId} || ':' || ${shifts.employeeId}`.as("id"),
        companyId: sql<string>`${user.companyId}`.as("company_id"),
        employeeId: shifts.employeeId,
        weekStart: sql<string>`${weekStart}`.as("week_start"),
        status: sql<string>`'pending'`.as("status"),
        attempts: sql<number>`0`.as("attempts"),
        availableAt: sql<number>`${now.getTime()}`.as("available_at"),
        leaseToken: sql<null>`NULL`.as("lease_token"),
        leaseUntil: sql<null>`NULL`.as("lease_until"),
        sentAt: sql<null>`NULL`.as("sent_at"),
        createdAt: sql<number>`${now.getTime()}`.as("created_at"),
      }).from(shifts).where(drafts).groupBy(shifts.employeeId),
    );
    const log = db.insert(shiftLogs).select(
      db.select({
        id: sql<string>`${eventId}`.as("id"),
        companyId: sql<string>`${user.companyId}`.as("company_id"),
        shiftId: sql<null>`NULL`.as("shift_id"),
        actorId: sql<string>`${user.id}`.as("actor_id"),
        action: sql<string>`'published'`.as("action"),
        detail: sql<string>`'Published ' || count(*) || ' shift(s) for the week of ' || ${weekStart}`.as("detail"),
        weekStart: sql<string>`${weekStart}`.as("week_start"),
        createdAt: sql<number>`${now.getTime()}`.as("created_at"),
      }).from(shifts).where(drafts).having(sql`count(*) > 0`),
    );
    const publish = db.update(shifts).set({ status: "published", publishedAt: now }).where(drafts).returning({ id: shifts.id });
    // Demo sandboxes never email, so their batch has no outbox insert.
    const published = isDemoUser(user)
      ? (await db.batch([log, publish]))[1]
      : (await db.batch([outbox, log, publish]))[2];
    const count = published.length;

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
