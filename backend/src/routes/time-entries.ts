import { Elysia } from "elysia";
import type { TimeEntryStatus } from "@prisma/client";
import {
  ApiError,
  requireManager,
  requireUser,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";

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

const entryInclude = {
  employee: { select: { fullName: true } },
  reviewedBy: { select: { fullName: true } },
  shift: {
    select: {
      title: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  },
} as const;

export const timeEntriesRoutes = new Elysia({ prefix: "/time-entries" })
  .get("/active", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      const entry = await prisma.timeEntry.findFirst({
        where: { employeeId: user.id, status: "open" },
        include: entryInclude,
      });

      return { entry: entry ? serializeTimeEntry(entry) : null };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .get("/mine", async ({ headers, set, query }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const q = query as { from?: string; to?: string };

      const from = parseIsoDate(q.from);
      const to = parseIsoDate(q.to);
      if ((q.from && !from) || (q.to && !to)) {
        set.status = 400;
        return { error: "from and to must be valid ISO datetimes" };
      }
      if (from && to && to <= from) {
        set.status = 400;
        return { error: "to must be after from" };
      }

      const entries = await prisma.timeEntry.findMany({
        where: {
          employeeId: user.id,
          ...(from || to
            ? {
                clockInAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lt: to } : {}),
                },
              }
            : {}),
        },
        include: entryInclude,
        orderBy: [{ clockInAt: "desc" }],
      });

      return { entries: entries.map(serializeTimeEntry) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .get("/company", async ({ headers, set }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);

      const pending = await prisma.timeEntry.findMany({
        where: { companyId: user.companyId!, status: "pending" },
        include: entryInclude,
        orderBy: [{ clockOutAt: "asc" }, { createdAt: "asc" }],
      });

      const recent = await prisma.timeEntry.findMany({
        where: {
          companyId: user.companyId!,
          status: { in: ["approved", "denied"] },
        },
        include: entryInclude,
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
      });

      return {
        pending: pending.map(serializeTimeEntry),
        recent: recent.map(serializeTimeEntry),
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
  .post("/clock-in", async ({ headers, set, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      if (!user.companyId) {
        set.status = 400;
        return { error: "No company associated" };
      }

      const payload = body as { shift_id?: string };
      const shiftId = payload.shift_id?.trim();
      if (!shiftId) {
        set.status = 400;
        return { error: "shift_id is required" };
      }

      const shift = await prisma.shift.findFirst({
        where: {
          id: shiftId,
          companyId: user.companyId,
          employeeId: user.id,
        },
      });
      if (!shift) {
        set.status = 404;
        return { error: "Shift not found" };
      }
      if (shift.status !== "published") {
        set.status = 400;
        return { error: "You can only clock in to a published shift" };
      }

      const existing = await prisma.timeEntry.findUnique({
        where: { shiftId: shift.id },
      });
      if (existing) {
        set.status = 400;
        return { error: "This shift already has a time entry" };
      }

      const openEntry = await prisma.timeEntry.findFirst({
        where: { employeeId: user.id, status: "open" },
      });
      if (openEntry) {
        set.status = 400;
        return { error: "You already have an open clock-in. Clock out first." };
      }

      const now = new Date();
      const windowStart = new Date(shift.startTime.getTime() - CLOCK_IN_EARLY_MS);
      if (now < windowStart) {
        set.status = 400;
        return {
          error: "Too early to clock in. You can clock in up to 30 minutes before the shift starts.",
        };
      }
      if (now > shift.endTime) {
        set.status = 400;
        return { error: "This shift has already ended" };
      }

      const created = await prisma.timeEntry.create({
        data: {
          companyId: user.companyId,
          employeeId: user.id,
          shiftId: shift.id,
          punchedInAt: now,
          clockInAt: now,
          status: "open",
        },
        include: entryInclude,
      });

      return { entry: serializeTimeEntry(created) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/clock-out", async ({ headers, set, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      const payload = body as { shift_id?: string };
      const shiftId = payload.shift_id?.trim();
      if (!shiftId) {
        set.status = 400;
        return { error: "shift_id is required" };
      }

      const entry = await prisma.timeEntry.findFirst({
        where: {
          shiftId,
          employeeId: user.id,
          status: "open",
        },
      });
      if (!entry) {
        set.status = 404;
        return { error: "No open clock-in found for this shift" };
      }

      const now = new Date();
      if (now <= entry.clockInAt) {
        set.status = 400;
        return { error: "Clock-out must be after clock-in" };
      }

      const updated = await prisma.timeEntry.update({
        where: { id: entry.id },
        data: {
          punchedOutAt: now,
          clockOutAt: now,
          status: "pending",
        },
        include: entryInclude,
      });

      return { entry: serializeTimeEntry(updated) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/:id/review", async ({ headers, set, params, body }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const payload = body as {
        decision?: string;
        clock_in_at?: string;
        clock_out_at?: string;
        note?: string | null;
      };

      const decision = payload.decision;
      if (decision !== "approved" && decision !== "denied") {
        set.status = 400;
        return { error: 'decision must be "approved" or "denied"' };
      }

      const row = await prisma.timeEntry.findFirst({
        where: { id: params.id, companyId: user.companyId! },
      });
      if (!row) {
        set.status = 404;
        return { error: "Time entry not found" };
      }
      if (row.status !== "pending") {
        set.status = 400;
        return { error: "Only pending time entries can be reviewed" };
      }
      if (row.employeeId === user.id) {
        set.status = 403;
        return { error: "You cannot review your own time entry" };
      }

      let clockInAt = row.clockInAt;
      let clockOutAt = row.clockOutAt;
      if (!clockOutAt) {
        set.status = 400;
        return { error: "Time entry is missing a clock-out time" };
      }

      if (payload.clock_in_at !== undefined) {
        const parsed = parseIsoDate(payload.clock_in_at);
        if (!parsed) {
          set.status = 400;
          return { error: "clock_in_at must be a valid ISO datetime" };
        }
        clockInAt = parsed;
      }
      if (payload.clock_out_at !== undefined) {
        const parsed = parseIsoDate(payload.clock_out_at);
        if (!parsed) {
          set.status = 400;
          return { error: "clock_out_at must be a valid ISO datetime" };
        }
        clockOutAt = parsed;
      }
      if (clockOutAt <= clockInAt) {
        set.status = 400;
        return { error: "Clock-out must be after clock-in" };
      }

      const reviewNote =
        typeof payload.note === "string" && payload.note.trim()
          ? payload.note.trim().slice(0, 500)
          : null;

      const updated = await prisma.timeEntry.update({
        where: { id: row.id },
        data: {
          clockInAt,
          clockOutAt,
          status: decision,
          reviewNote,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
        include: entryInclude,
      });

      return { entry: serializeTimeEntry(updated) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
