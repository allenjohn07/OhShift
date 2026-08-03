import {
  availabilityConflictMessage,
  ohShiftDayOfWeek,
} from "./availability-check";
import { prisma } from "./prisma";
import { serializeShift } from "./serialize";
import {
  findOverlappingShifts,
  findShiftWithSameStart,
  formatConflictMessage,
  formatSameStartMessage,
} from "./shift-conflicts";
import { logShiftAction } from "./shift-log";
import {
  approvedTimeOffConflictMessage,
  reasonFromAvailabilityMessage,
  type EligibilityReason,
} from "./time-off-check";
import { ApiError, verifyEmployeeInCompany } from "./auth-guard";

export type CreateDraftShiftInput = {
  companyId: string;
  actorId: string;
  employeeId: string;
  title: string;
  start: Date;
  end: Date;
  timezone?: string;
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

export async function validateShiftAssignment(options: {
  employeeId: string;
  start: Date;
  end: Date;
  timezone?: string;
  excludeShiftId?: string;
}): Promise<CreateDraftShiftFailure | null> {
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
  const window = await prisma.availabilityWindow.findUnique({
    where: {
      userId_dayOfWeek: { userId: employeeId, dayOfWeek },
    },
  });
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

  const timeOffError = await approvedTimeOffConflictMessage(
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

  const sameStart = await findShiftWithSameStart(
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

  const conflicts = await findOverlappingShifts(
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

export async function createDraftShift(
  input: CreateDraftShiftInput,
): Promise<CreateDraftShiftSuccess | CreateDraftShiftFailure> {
  const { companyId, actorId, employeeId, title, start, end, timezone } =
    input;

  let employee;
  try {
    employee = await verifyEmployeeInCompany(employeeId, companyId);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        error: err.message,
        reason: "invalid",
        status: err.status,
      };
    }
    throw err;
  }

  const validationError = await validateShiftAssignment({
    employeeId,
    start,
    end,
    timezone,
  });
  if (validationError) return validationError;

  const shift = await prisma.shift.create({
    data: {
      companyId,
      employeeId,
      title,
      startTime: start,
      endTime: end,
      status: "draft",
    },
  });

  await logShiftAction({
    companyId,
    actorId,
    action: "created",
    shiftId: shift.id,
    detail: `Assigned "${title}" to ${employee.fullName} on ${start.toDateString()}`,
  });

  return { ok: true, shift: serializeShift(shift) };
}

export async function evaluateEligibility(options: {
  employeeId: string;
  designation: string | null;
  filterDesignation: string | null;
  start: Date;
  end: Date;
  timezone?: string;
}): Promise<{ eligible: boolean; reason: EligibilityReason }> {
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

  const validationError = await validateShiftAssignment({
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

// Re-export for routes that catch ApiError from verifyEmployeeInCompany
export { ApiError };
