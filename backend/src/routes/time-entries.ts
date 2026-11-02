import * as v from "../lib/validation";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { shifts, timeEntries, type TimeEntryStatus } from "../db/schema";
import { jsonBody, requireManager, requireUser, queryParams } from "../lib/auth-guard";

const CLOCK_IN_EARLY_MS = 30 * 60 * 1000;

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function serializeTimeEntry(row: {
  id: string;
  companyId: string;
  employeeId: string;
  shiftId: string;
  punchedInAt: Date;
  punchedOutAt: Date | null;
  clockInAt: Date;
  clockOutAt: Date | null;
  status: TimeEntryStatus;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  employee?: { fullName: string } | null;
  reviewedBy?: { fullName: string } | null;
  shift?: {
    title: string;
    startTime: Date;
    endTime: Date;
    status: string;
  } | null;
}) {
  return {
    id: row.id,
    company_id: row.companyId,
    employee_id: row.employeeId,
    shift_id: row.shiftId,
    punched_in_at: row.punchedInAt.toISOString(),
    punched_out_at: row.punchedOutAt?.toISOString() ?? null,
    clock_in_at: row.clockInAt.toISOString(),
    clock_out_at: row.clockOutAt?.toISOString() ?? null,
    status: row.status,
    review_note: row.reviewNote,
    reviewed_by_id: row.reviewedById,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    employee: row.employee
      ? { full_name: row.employee.fullName }
      : undefined,
    reviewed_by: row.reviewedBy
      ? { full_name: row.reviewedBy.fullName }
      : undefined,
    shift: row.shift
      ? {
          title: row.shift.title,
          start_time: row.shift.startTime.toISOString(),
          end_time: row.shift.endTime.toISOString(),
          status: row.shift.status,
        }
      : undefined,
  };
}

const entryWith = {
  employee: { columns: { fullName: true } },
  reviewedBy: { columns: { fullName: true } },
  shift: {
    columns: {
      title: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  },
} as const;

async function loadEntry(id: string) {
  const entry = await db.query.timeEntries.findFirst({
    where: eq(timeEntries.id, id),
    with: entryWith,
  });
  return serializeTimeEntry(entry!);
}

type ClockBody = { shift_id: string };

type ReviewEntryBody = {
  decision: string;
  clock_in_at: string;
  clock_out_at: string;
  note: string | null;
};

export const timeEntriesRoutes = new Hono()
  .get("/active", async (c) => {
    const user = await requireUser(c);

    const entry = await db.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.employeeId, user.id),
        eq(timeEntries.status, "open"),
      ),
      with: entryWith,
    });

    return c.json({ entry: entry ? serializeTimeEntry(entry) : null });
  })
  .get("/mine", queryParams<"from" | "to">({ from: v.instant, to: v.instant }), async (c) => {
    const user = await requireUser(c);
    const fromRaw = c.req.query("from");
    const toRaw = c.req.query("to");

    const from = parseIsoDate(fromRaw);
    const to = parseIsoDate(toRaw);
    if ((fromRaw && !from) || (toRaw && !to)) {
      return c.json({ error: "from and to must be valid ISO datetimes" }, 400);
    }
    if (from && to && to <= from) {
      return c.json({ error: "to must be after from" }, 400);
    }

    const entries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.employeeId, user.id),
        from ? gte(timeEntries.clockInAt, from) : undefined,
        to ? lt(timeEntries.clockInAt, to) : undefined,
      ),
      with: entryWith,
      orderBy: desc(timeEntries.clockInAt),
    });

    return c.json({ entries: entries.map(serializeTimeEntry) });
  })
  .get("/company", async (c) => {
    const user = await requireManager(c);

    const [pending, recent] = await db.batch([
      db.query.timeEntries.findMany({
        where: and(
          eq(timeEntries.companyId, user.companyId),
          eq(timeEntries.status, "pending"),
        ),
        with: entryWith,
        orderBy: [asc(timeEntries.clockOutAt), asc(timeEntries.createdAt)],
      }),
      db.query.timeEntries.findMany({
        where: and(
          eq(timeEntries.companyId, user.companyId),
          inArray(timeEntries.status, ["approved", "denied"]),
        ),
        with: entryWith,
        orderBy: [desc(timeEntries.reviewedAt), desc(timeEntries.createdAt)],
        limit: 20,
      }),
    ]);

    return c.json({
      pending: pending.map(serializeTimeEntry),
      recent: recent.map(serializeTimeEntry),
    });
  })
  .post("/clock-in", jsonBody<ClockBody>({ shift_id: v.text(100, 1) }), async (c) => {
    const user = await requireUser(c);
    if (!user.companyId) {
      return c.json({ error: "No company associated" }, 400);
    }

    const payload = c.req.valid("json");
    const shiftId = payload.shift_id?.trim();
    if (!shiftId) {
      return c.json({ error: "shift_id is required" }, 400);
    }

    // Plain selects: drizzle's findFirst crashes inside db.batch on empty results.
    const [[shift], [existing], [openEntry]] = await db.batch([
      db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.id, shiftId),
            eq(shifts.companyId, user.companyId),
            eq(shifts.employeeId, user.id),
          ),
        )
        .limit(1),
      db
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(eq(timeEntries.shiftId, shiftId))
        .limit(1),
      db
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.employeeId, user.id),
            eq(timeEntries.status, "open"),
          ),
        )
        .limit(1),
    ]);

    if (!shift) {
      return c.json({ error: "Shift not found" }, 404);
    }
    if (shift.status !== "published") {
      return c.json({ error: "You can only clock in to a published shift" }, 400);
    }
    if (existing) {
      return c.json({ error: "This shift already has a time entry" }, 400);
    }
    if (openEntry) {
      return c.json({ error: "You already have an open clock-in. Clock out first." }, 400);
    }

    const now = new Date();
    const windowStart = new Date(shift.startTime.getTime() - CLOCK_IN_EARLY_MS);
    if (now < windowStart) {
      return c.json(
        {
          error: "Too early to clock in. You can clock in up to 30 minutes before the shift starts.",
        },
        400,
      );
    }
    if (now > shift.endTime) {
      return c.json({ error: "This shift has already ended" }, 400);
    }

    const [created] = await db
      .insert(timeEntries)
      .values({
        companyId: user.companyId,
        employeeId: user.id,
        shiftId: shift.id,
        punchedInAt: now,
        clockInAt: now,
        status: "open",
      })
      .returning({ id: timeEntries.id });

    return c.json({ entry: await loadEntry(created!.id) });
  })
  .post("/clock-out", jsonBody<ClockBody>({ shift_id: v.text(100, 1) }), async (c) => {
    const user = await requireUser(c);

    const payload = c.req.valid("json");
    const shiftId = payload.shift_id?.trim();
    if (!shiftId) {
      return c.json({ error: "shift_id is required" }, 400);
    }

    const entry = await db.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.shiftId, shiftId),
        eq(timeEntries.employeeId, user.id),
        eq(timeEntries.status, "open"),
      ),
    });
    if (!entry) {
      return c.json({ error: "No open clock-in found for this shift" }, 404);
    }

    const now = new Date();
    if (now <= entry.clockInAt) {
      return c.json({ error: "Clock-out must be after clock-in" }, 400);
    }

    await db
      .update(timeEntries)
      .set({
        punchedOutAt: now,
        clockOutAt: now,
        status: "pending",
      })
      .where(eq(timeEntries.id, entry.id));

    return c.json({ entry: await loadEntry(entry.id) });
  })
  .post("/:id/review", jsonBody<ReviewEntryBody>({ decision: v.oneOf("approved", "denied"), clock_in_at: v.instant, clock_out_at: v.instant, note: v.nullable(v.text(500)) }), async (c) => {
    const user = await requireManager(c);
    const payload = c.req.valid("json");

    const decision = payload.decision;
    if (decision !== "approved" && decision !== "denied") {
      return c.json({ error: 'decision must be "approved" or "denied"' }, 400);
    }

    const row = await db.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.id, c.req.param("id")),
        eq(timeEntries.companyId, user.companyId),
      ),
    });
    if (!row) {
      return c.json({ error: "Time entry not found" }, 404);
    }
    if (row.status !== "pending") {
      return c.json({ error: "Only pending time entries can be reviewed" }, 400);
    }
    if (row.employeeId === user.id) {
      return c.json({ error: "You cannot review your own time entry" }, 403);
    }

    let clockInAt = row.clockInAt;
    let clockOutAt = row.clockOutAt;
    if (!clockOutAt) {
      return c.json({ error: "Time entry is missing a clock-out time" }, 400);
    }

    if (payload.clock_in_at !== undefined) {
      const parsed = parseIsoDate(payload.clock_in_at);
      if (!parsed) {
        return c.json({ error: "clock_in_at must be a valid ISO datetime" }, 400);
      }
      clockInAt = parsed;
    }
    if (payload.clock_out_at !== undefined) {
      const parsed = parseIsoDate(payload.clock_out_at);
      if (!parsed) {
        return c.json({ error: "clock_out_at must be a valid ISO datetime" }, 400);
      }
      clockOutAt = parsed;
    }
    if (clockOutAt <= clockInAt) {
      return c.json({ error: "Clock-out must be after clock-in" }, 400);
    }

    const reviewNote =
      typeof payload.note === "string" && payload.note.trim()
        ? payload.note.trim().slice(0, 500)
        : null;

    await db
      .update(timeEntries)
      .set({
        clockInAt,
        clockOutAt,
        status: decision,
        reviewNote,
        reviewedById: user.id,
        reviewedAt: new Date(),
      })
      .where(eq(timeEntries.id, row.id));

    return c.json({ entry: await loadEntry(row.id) });
  });
