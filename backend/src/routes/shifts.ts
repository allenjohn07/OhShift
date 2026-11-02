import * as v from "../lib/validation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { shifts, users } from "../db/schema";
import { loadAssignmentContext } from "../lib/assignment-context";
import { jsonBody, requireManager, requireUser, queryParams } from "../lib/auth-guard";
import { serializeShift } from "../lib/serialize";
import {
  createDraftShifts,
  evaluateEligibility,
  validateShiftAssignment,
} from "../lib/shift-create";
import { logShiftAction } from "../lib/shift-log";

const BULK_MAX = 50;

async function findCompanyShift(shiftId: string, companyId: string) {
  return db.query.shifts.findFirst({
    where: and(eq(shifts.id, shiftId), eq(shifts.companyId, companyId)),
    with: { employee: { columns: { fullName: true } } },
  });
}

type BulkShiftsBody = {
  timezone: string;
  shifts: Array<{
    employeeId?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
  }>;
};

type CreateShiftBody = {
  employeeId: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

type UpdateShiftBody = {
  shiftId: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

export const shiftsRoutes = new Hono()
  .get("/mine", async (c) => {
    const user = await requireUser(c);
    const rows = await db.query.shifts.findMany({
      where: and(eq(shifts.employeeId, user.id), eq(shifts.status, "published")),
      orderBy: asc(shifts.startTime),
    });
    return c.json({ shifts: rows.map((s) => serializeShift(s)) });
  })
  .get("/eligible", queryParams<"start" | "end" | "timezone" | "designation">({ start: v.instant, end: v.instant, timezone: v.timezone, designation: v.text(120) }), async (c) => {
    const user = await requireManager(c);
    const startRaw = c.req.query("start") ?? "";
    const endRaw = c.req.query("end") ?? "";
    const timezone = c.req.query("timezone")?.trim() || undefined;
    const designationFilter = c.req.query("designation")?.trim() || null;

    if (!startRaw || !endRaw) {
      return c.json({ error: "start and end are required" }, 400);
    }

    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return c.json({ error: "Invalid start or end time" }, 400);
    }
    if (start >= end || end.getTime() - start.getTime() > 86_400_000) {
      return c.json({ error: "Provide a positive shift duration of at most 24 hours." }, 400);
    }

    const [members, ctx] = await Promise.all([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          designation: users.designation,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.companyId, user.companyId),
            inArray(users.role, ["employee", "manager"]),
          ),
        )
        .orderBy(asc(users.fullName)),
      loadAssignmentContext(user.companyId, start, end),
    ]);

    const people = members.map((m) => {
      const { eligible, reason } = evaluateEligibility(ctx, {
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
    });

    const designations = [
      ...new Set(
        members
          .map((m) => m.designation?.trim())
          .filter((d): d is string => Boolean(d)),
      ),
    ].sort((a, b) => a.localeCompare(b));

    return c.json({ people, designations });
  })
  .post("/bulk", jsonBody<BulkShiftsBody>({ timezone: v.timezone, shifts: v.array(v.object({ employeeId: v.text(100, 1), title: v.text(120, 1), startTime: v.instant, endTime: v.instant }), 1, 50) }), async (c) => {
    const user = await requireManager(c);
    const { timezone, shifts: items } = c.req.valid("json");

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: "shifts array is required" }, 400);
    }
    if (items.length > BULK_MAX) {
      return c.json({ error: `At most ${BULK_MAX} shifts per request` }, 400);
    }

    const normalized = items.map((item) => ({
      employeeId: item.employeeId?.trim() ?? "",
      title: item.title?.trim() ?? "",
      startTime: item.startTime,
      endTime: item.endTime,
    }));
    const valid = normalized.filter(
      (item) => item.employeeId && item.title && item.startTime && item.endTime,
    );

    const outcomes = await createDraftShifts({
      companyId: user.companyId,
      actorId: user.id,
      timezone,
      items: valid.map((item) => ({
        employeeId: item.employeeId,
        title: item.title,
        start: new Date(item.startTime!),
        end: new Date(item.endTime!),
      })),
    });

    let created = 0;
    let failed = 0;
    let next = 0;
    const results = normalized.map((item) => {
      if (!valid.includes(item)) {
        failed += 1;
        return {
          employee_id: item.employeeId || "unknown",
          ok: false,
          error: "Missing required fields",
        };
      }
      const outcome = outcomes[next++]!;
      if (outcome.ok) {
        created += 1;
        return { employee_id: item.employeeId, ok: true, shift: outcome.shift };
      }
      failed += 1;
      return { employee_id: item.employeeId, ok: false, error: outcome.error };
    });

    return c.json({ created, failed, results });
  })
  .post("/", jsonBody<CreateShiftBody>({ employeeId: v.text(100, 1), title: v.text(120, 1), startTime: v.instant, endTime: v.instant, timezone: v.timezone }), async (c) => {
    const user = await requireManager(c);
    const { employeeId, title, startTime, endTime, timezone } = c.req.valid("json");

    if (!employeeId || !title || !startTime || !endTime) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const [outcome] = await createDraftShifts({
      companyId: user.companyId,
      actorId: user.id,
      timezone,
      items: [
        {
          employeeId,
          title,
          start: new Date(startTime),
          end: new Date(endTime),
        },
      ],
    });

    if (!outcome!.ok) {
      return c.json({ error: outcome!.error }, outcome!.status as 400);
    }

    return c.json({ shift: outcome!.shift });
  })
  .put("/", jsonBody<UpdateShiftBody>({ shiftId: v.text(100, 1), title: v.text(120, 1), startTime: v.instant, endTime: v.instant, timezone: v.timezone }), async (c) => {
    const user = await requireManager(c);
    const { shiftId, title, startTime, endTime, timezone } = c.req.valid("json");

    if (!shiftId || !title || !startTime || !endTime) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const existing = await findCompanyShift(shiftId, user.companyId);
    if (!existing) {
      return c.json({ error: "Shift not found or access denied" }, 404);
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    const ctx = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      ? { windows: new Map(), timeOff: new Map(), shifts: new Map() }
      : await loadAssignmentContext(user.companyId, start, end);
    const validationError = validateShiftAssignment(ctx, {
      employeeId: existing.employeeId,
      start,
      end,
      timezone,
      excludeShiftId: shiftId,
    });
    if (validationError) {
      return c.json(
        { error: validationError.error },
        validationError.status as 400,
      );
    }

    const [shift] = await db
      .update(shifts)
      .set({ title, startTime: start, endTime: end })
      .where(eq(shifts.id, shiftId))
      .returning();

    await logShiftAction({
      companyId: user.companyId,
      actorId: user.id,
      action: "updated",
      shiftId: shift!.id,
      detail: `Updated "${title}" for ${existing.employee.fullName} on ${start.toDateString()}`,
    });

    return c.json({ shift: serializeShift(shift!) });
  })
  .delete("/", queryParams<"id">({ id: v.text(100, 1) }), async (c) => {
    const user = await requireManager(c);
    const shiftId = c.req.query("id");

    if (!shiftId) {
      return c.json({ error: "Missing shift ID" }, 400);
    }

    const existing = await findCompanyShift(shiftId, user.companyId);
    if (!existing) {
      return c.json({ error: "Shift not found or access denied" }, 404);
    }

    await db.delete(shifts).where(eq(shifts.id, shiftId));

    await logShiftAction({
      companyId: user.companyId,
      actorId: user.id,
      action: "deleted",
      shiftId: null,
      detail: `Deleted "${existing.title}" for ${existing.employee.fullName} on ${existing.startTime.toDateString()}`,
    });

    return c.json({ message: "Shift deleted successfully" });
  });
