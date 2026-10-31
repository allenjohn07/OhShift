import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { shifts, users, type Shift } from "../db/schema";
import {
  addShiftToContext,
  loadAssignmentContext,
  type AssignmentContext,
} from "./assignment-context";
import {
  availabilityConflictMessage,
  ohShiftDayOfWeek,
} from "./availability-check";
import { serializeShift } from "./serialize";
import {
  findOverlappingShifts,
  findShiftWithSameStart,
  formatConflictMessage,
  formatSameStartMessage,
} from "./shift-conflicts";
import { shiftLogInsert } from "./shift-log";
import {
  approvedTimeOffConflictMessage,
  reasonFromAvailabilityMessage,
  type EligibilityReason,
} from "./time-off-check";

export type CreateDraftShiftInput = {
  employeeId: string;
  title: string;
  start: Date;
  end: Date;
};

export type CreateDraftShiftSuccess = {
  ok: true;
  shift: ReturnType<typeof serializeShift>;
};

export type CreateDraftShiftFailure = {
  ok: false;
  error: string;
  reason?: EligibilityReason | "conflict" | "same_start" | "invalid";
  status: number;
};

export function validateShiftAssignment(
  ctx: AssignmentContext,
  options: {
    employeeId: string;
    start: Date;
    end: Date;
    timezone?: string;
    excludeShiftId?: string;
  },
): CreateDraftShiftFailure | null {
  const { employeeId, start, end, timezone, excludeShiftId } = options;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      ok: false,
      error: "Invalid start or end time",
      reason: "invalid",
      status: 400,
    };
  }
  if (start >= end) {
    return {
      ok: false,
      error: "End time must be after start time",
      reason: "invalid",
      status: 400,
    };
  }

  const dayOfWeek = ohShiftDayOfWeek(start, timezone);
  const window = ctx.windows.get(employeeId)?.get(dayOfWeek);
  const availabilityError = availabilityConflictMessage(
    window,
    start,
    end,
    timezone,
  );
  if (availabilityError) {
    return {
      ok: false,
      error: availabilityError,
      reason: reasonFromAvailabilityMessage(availabilityError) ?? "unavailable",
      status: 400,
    };
  }

  const timeOffError = approvedTimeOffConflictMessage(
    ctx,
    employeeId,
    start,
    end,
    timezone,
  );
  if (timeOffError) {
    return {
      ok: false,
      error: timeOffError,
      reason: "time_off",
      status: 400,
    };
  }

  const sameStart = findShiftWithSameStart(
    ctx,
    employeeId,
    start,
    excludeShiftId,
  );
  if (sameStart) {
    return {
      ok: false,
      error: formatSameStartMessage(sameStart),
      reason: "same_start",
      status: 409,
    };
  }

  const conflicts = findOverlappingShifts(
    ctx,
    employeeId,
    start,
    end,
    excludeShiftId,
  );
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: formatConflictMessage(conflicts),
      reason: "conflict",
      status: 409,
    };
  }

  return null;
}

function validTimes(items: { start: Date; end: Date }[]) {
  return items.flatMap(({ start, end }) =>
    Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      ? []
      : [start.getTime(), end.getTime()],
  );
}

/**
 * Validate and create draft shifts in order. Each item sees shifts created by
 * earlier items. All reads happen in one batch and all writes in another.
 */
export async function createDraftShifts(options: {
  companyId: string;
  actorId: string;
  timezone?: string;
  items: CreateDraftShiftInput[];
}): Promise<Array<CreateDraftShiftSuccess | CreateDraftShiftFailure>> {
  const { companyId, actorId, timezone, items } = options;
  if (items.length === 0) return [];

  const times = validTimes(items);
  const from = new Date(times.length ? Math.min(...times) : 0);
  const to = new Date(times.length ? Math.max(...times) : 0);

  const employeeIds = [...new Set(items.map((i) => i.employeeId))];
  const [ctx, members] = await Promise.all([
    loadAssignmentContext(companyId, from, to),
    db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(
        and(eq(users.companyId, companyId), inArray(users.id, employeeIds)),
      ),
  ]);
  const memberNames = new Map(members.map((m) => [m.id, m.fullName]));

  const results: Array<CreateDraftShiftSuccess | CreateDraftShiftFailure> = [];
  const statements: Parameters<typeof db.batch>[0][number][] = [];

  for (const { employeeId, title, start, end } of items) {
    const employeeName = memberNames.get(employeeId);
    if (!employeeName) {
      results.push({
        ok: false,
        error: "Invalid employee",
        reason: "invalid",
        status: 400,
      });
      continue;
    }

    const validationError = validateShiftAssignment(ctx, {
      employeeId,
      start,
      end,
      timezone,
    });
    if (validationError) {
      results.push(validationError);
      continue;
    }

    const shift: Shift = {
      id: crypto.randomUUID(),
      companyId,
      employeeId,
      title,
      startTime: start,
      endTime: end,
      status: "draft",
      publishedAt: null,
      createdAt: new Date(),
    };
    addShiftToContext(ctx, employeeId, shift);

    statements.push(
      db.insert(shifts).values(shift),
      shiftLogInsert({
        companyId,
        actorId,
        action: "created",
        shiftId: shift.id,
        detail: `Assigned "${title}" to ${employeeName} on ${start.toDateString()}`,
      }),
    );
    results.push({ ok: true, shift: serializeShift(shift) });
  }

  const [first, ...rest] = statements;
  if (first) {
    await db.batch([first, ...rest]);
  }

  return results;
}

export function evaluateEligibility(
  ctx: AssignmentContext,
  options: {
    employeeId: string;
    designation: string | null;
    filterDesignation: string | null;
    start: Date;
    end: Date;
    timezone?: string;
  },
): { eligible: boolean; reason: EligibilityReason } {
  const {
    employeeId,
    designation,
    filterDesignation,
    start,
    end,
    timezone,
  } = options;

  if (filterDesignation) {
    const needle = filterDesignation.trim().toLowerCase();
    const hay = (designation ?? "").trim().toLowerCase();
    if (!hay || hay !== needle) {
      return { eligible: false, reason: "designation_mismatch" };
    }
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return { eligible: false, reason: "outside_window" };
  }

  const validationError = validateShiftAssignment(ctx, {
    employeeId,
    start,
    end,
    timezone,
  });
  if (!validationError) {
    return { eligible: true, reason: null };
  }

  if (
    validationError.reason === "conflict" ||
    validationError.reason === "same_start"
  ) {
    return { eligible: false, reason: "conflict" };
  }
  if (validationError.reason === "time_off") {
    return { eligible: false, reason: "time_off" };
  }
  if (validationError.reason === "outside_window") {
    return { eligible: false, reason: "outside_window" };
  }
  return { eligible: false, reason: "unavailable" };
}
