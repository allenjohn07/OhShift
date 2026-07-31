import { Elysia } from "elysia";
import type { TimeOffStatus, TimeOffType } from "@prisma/client";
import {
  ApiError,
  requireManager,
  requireUser,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";

const TYPES: TimeOffType[] = ["vacation", "sick", "personal", "other"];

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

export const timeOffRoutes = new Elysia({ prefix: "/time-off" })
  .get("/", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      const requests = await prisma.timeOffRequest.findMany({
        where: { employeeId: user.id },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      });

      return { requests: requests.map(serializeTimeOff) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/", async ({ headers, set, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      if (!user.companyId) {
        set.status = 400;
        return { error: "No company associated" };
      }

      const payload = body as {
        type?: string;
        start_date?: string;
        end_date?: string;
        note?: string | null;
      };

      const type = payload.type as TimeOffType;
      if (!TYPES.includes(type)) {
        set.status = 400;
        return { error: "Invalid type" };
      }

      const startDate = parseDateOnly(String(payload.start_date ?? ""));
      const endDate = parseDateOnly(String(payload.end_date ?? ""));
      if (!startDate || !endDate) {
        set.status = 400;
        return { error: "start_date and end_date must be YYYY-MM-DD" };
      }
      if (endDate < startDate) {
        set.status = 400;
        return { error: "End date must be on or after start date" };
      }

      const note =
        typeof payload.note === "string" && payload.note.trim()
          ? payload.note.trim().slice(0, 500)
          : null;

      const existing = await prisma.timeOffRequest.findMany({
        where: {
          employeeId: user.id,
          status: { in: ["pending", "approved"] },
        },
      });

      const conflict = existing.find((row) =>
        rangesOverlap(startDate, endDate, row.startDate, row.endDate),
      );
      if (conflict) {
        set.status = 400;
        return {
          error: "Overlaps an existing pending or approved time-off request",
        };
      }

      const created = await prisma.timeOffRequest.create({
        data: {
          companyId: user.companyId,
          employeeId: user.id,
          type,
          startDate,
          endDate,
          note,
        },
      });

      return { request: serializeTimeOff(created) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/:id/cancel", async ({ headers, set, params }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);

      const row = await prisma.timeOffRequest.findFirst({
        where: { id: params.id, employeeId: user.id },
      });
      if (!row) {
        set.status = 404;
        return { error: "Request not found" };
      }
      if (row.status !== "pending") {
        set.status = 400;
        return { error: "Only pending requests can be cancelled" };
      }

      const updated = await prisma.timeOffRequest.update({
        where: { id: row.id },
        data: { status: "cancelled" },
      });

      return { request: serializeTimeOff(updated) };
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

      const pending = await prisma.timeOffRequest.findMany({
        where: { companyId: user.companyId!, status: "pending" },
        include: {
          employee: { select: { fullName: true } },
        },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      });

      const recent = await prisma.timeOffRequest.findMany({
        where: {
          companyId: user.companyId!,
          status: { in: ["approved", "denied", "cancelled"] },
        },
        include: {
          employee: { select: { fullName: true } },
          reviewedBy: { select: { fullName: true } },
        },
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
      });

      return {
        pending: pending.map(serializeTimeOff),
        recent: recent.map(serializeTimeOff),
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
  .post("/:id/review", async ({ headers, set, params, body }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const payload = body as { decision?: string };
      const decision = payload.decision;
      if (decision !== "approved" && decision !== "denied") {
        set.status = 400;
        return { error: 'decision must be "approved" or "denied"' };
      }

      const row = await prisma.timeOffRequest.findFirst({
        where: { id: params.id, companyId: user.companyId! },
      });
      if (!row) {
        set.status = 404;
        return { error: "Request not found" };
      }
      if (row.status !== "pending") {
        set.status = 400;
        return { error: "Only pending requests can be reviewed" };
      }
      if (row.employeeId === user.id) {
        set.status = 403;
        return { error: "You cannot review your own time-off request" };
      }

      const updated = await prisma.timeOffRequest.update({
        where: { id: row.id },
        data: {
          status: decision,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
        include: {
          employee: { select: { fullName: true } },
          reviewedBy: { select: { fullName: true } },
        },
      });

      return { request: serializeTimeOff(updated) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
