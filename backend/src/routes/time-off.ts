import * as v from "../lib/validation";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import {
  TIME_OFF_TYPES,
  timeOffRequests,
  type TimeOffStatus,
  type TimeOffType,
} from "../db/schema";
import { jsonBody, requireManager, requireUser } from "../lib/auth-guard";

const TYPES: readonly TimeOffType[] = TIME_OFF_TYPES;

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) {
  return aStart <= bEnd && bStart <= aEnd;
}

function serializeTimeOff(
  row: {
    id: string;
    companyId: string;
    employeeId: string;
    type: TimeOffType;
    startDate: Date;
    endDate: Date;
    note: string | null;
    status: TimeOffStatus;
    reviewedById: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    employee?: { fullName: string } | null;
    reviewedBy?: { fullName: string } | null;
  },
) {
  return {
    id: row.id,
    company_id: row.companyId,
    employee_id: row.employeeId,
    type: row.type,
    start_date: toDateKey(row.startDate),
    end_date: toDateKey(row.endDate),
    note: row.note,
    status: row.status,
    reviewed_by_id: row.reviewedById,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    employee: row.employee
      ? { full_name: row.employee.fullName }
      : undefined,
    reviewed_by: row.reviewedBy
      ? { full_name: row.reviewedBy.fullName }
      : undefined,
  };
}

const withNames = {
  employee: { columns: { fullName: true } },
  reviewedBy: { columns: { fullName: true } },
} as const;

type TimeOffBody = {
  type: string;
  start_date: string;
  end_date: string;
  note: string | null;
};

type ReviewBody = { decision: string };

export const timeOffRoutes = new Hono()
  .get("/", async (c) => {
    const user = await requireUser(c);

    const requests = await db.query.timeOffRequests.findMany({
      where: eq(timeOffRequests.employeeId, user.id),
      orderBy: [desc(timeOffRequests.startDate), desc(timeOffRequests.createdAt)],
    });

    return c.json({ requests: requests.map((r) => serializeTimeOff(r)) });
  })
  .post("/", jsonBody<TimeOffBody>({ type: v.oneOf("vacation", "sick", "personal", "other"), start_date: v.dateOnly, end_date: v.dateOnly, note: v.nullable(v.text(500)) }), async (c) => {
    const user = await requireUser(c);
    if (!user.companyId) {
      return c.json({ error: "No company associated" }, 400);
    }

    const payload = c.req.valid("json");

    const type = payload.type as TimeOffType;
    if (!TYPES.includes(type)) {
      return c.json({ error: "Invalid type" }, 400);
    }

    const startDate = parseDateOnly(String(payload.start_date ?? ""));
    const endDate = parseDateOnly(String(payload.end_date ?? ""));
    if (!startDate || !endDate) {
      return c.json({ error: "start_date and end_date must be YYYY-MM-DD" }, 400);
    }
    if (endDate < startDate) {
      return c.json({ error: "End date must be on or after start date" }, 400);
    }

    const note =
      typeof payload.note === "string" && payload.note.trim()
        ? payload.note.trim().slice(0, 500)
        : null;

    const existing = await db.query.timeOffRequests.findMany({
      where: and(
        eq(timeOffRequests.employeeId, user.id),
        inArray(timeOffRequests.status, ["pending", "approved"]),
      ),
      columns: { startDate: true, endDate: true },
    });

    const conflict = existing.find((row) =>
      rangesOverlap(startDate, endDate, row.startDate, row.endDate),
    );
    if (conflict) {
      return c.json(
        { error: "Overlaps an existing pending or approved time-off request" },
        400,
      );
    }

    const [created] = await db
      .insert(timeOffRequests)
      .values({
        companyId: user.companyId,
        employeeId: user.id,
        type,
        startDate,
        endDate,
        note,
      })
      .returning();

    return c.json({ request: serializeTimeOff(created!) });
  })
  .post("/:id/cancel", async (c) => {
    const user = await requireUser(c);

    const row = await db.query.timeOffRequests.findFirst({
      where: and(
        eq(timeOffRequests.id, c.req.param("id")),
        eq(timeOffRequests.employeeId, user.id),
      ),
    });
    if (!row) {
      return c.json({ error: "Request not found" }, 404);
    }
    if (row.status !== "pending") {
      return c.json({ error: "Only pending requests can be cancelled" }, 400);
    }

    const [updated] = await db.update(timeOffRequests).set({ status: "cancelled" })
      .where(and(eq(timeOffRequests.id, row.id), eq(timeOffRequests.employeeId, user.id), eq(timeOffRequests.status, "pending"))).returning();
    if (!updated) return c.json({ error: "Request changed. Refresh and try again." }, 409);

    return c.json({ request: serializeTimeOff(updated!) });
  })
  .get("/company", async (c) => {
    const user = await requireManager(c);

    const [pending, recent] = await db.batch([
      db.query.timeOffRequests.findMany({
        where: and(
          eq(timeOffRequests.companyId, user.companyId),
          eq(timeOffRequests.status, "pending"),
        ),
        with: { employee: withNames.employee },
        orderBy: [asc(timeOffRequests.startDate), asc(timeOffRequests.createdAt)],
      }),
      db.query.timeOffRequests.findMany({
        where: and(
          eq(timeOffRequests.companyId, user.companyId),
          inArray(timeOffRequests.status, ["approved", "denied", "cancelled"]),
        ),
        with: withNames,
        // Postgres sorted NULL reviewed_at first on DESC; keep that order.
        orderBy: [
          desc(sql`${timeOffRequests.reviewedAt} IS NULL`),
          desc(timeOffRequests.reviewedAt),
          desc(timeOffRequests.createdAt),
        ],
        limit: 20,
      }),
    ]);

    return c.json({
      pending: pending.map((r) => serializeTimeOff(r)),
      recent: recent.map((r) => serializeTimeOff(r)),
    });
  })
  .post("/:id/review", jsonBody<ReviewBody>({ decision: v.oneOf("approved", "denied") }), async (c) => {
    const user = await requireManager(c);
    const { decision } = c.req.valid("json");
    if (decision !== "approved" && decision !== "denied") {
      return c.json({ error: 'decision must be "approved" or "denied"' }, 400);
    }

    const row = await db.query.timeOffRequests.findFirst({
      where: and(
        eq(timeOffRequests.id, c.req.param("id")),
        eq(timeOffRequests.companyId, user.companyId),
      ),
    });
    if (!row) {
      return c.json({ error: "Request not found" }, 404);
    }
    if (row.status !== "pending") {
      return c.json({ error: "Only pending requests can be reviewed" }, 400);
    }
    if (row.employeeId === user.id) {
      return c.json({ error: "You cannot review your own time-off request" }, 403);
    }

    const [reviewed] = await db
      .update(timeOffRequests)
      .set({
        status: decision,
        reviewedById: user.id,
        reviewedAt: new Date(),
      })
      .where(and(eq(timeOffRequests.id, row.id), eq(timeOffRequests.companyId, user.companyId), eq(timeOffRequests.status, "pending")))
      .returning({ id: timeOffRequests.id });
    if (!reviewed) return c.json({ error: "Request changed. Refresh and try again." }, 409);

    const updated = await db.query.timeOffRequests.findFirst({
      where: eq(timeOffRequests.id, row.id),
      with: withNames,
    });

    return c.json({ request: serializeTimeOff(updated!) });
  });
