import { prisma } from "./prisma";
import { localDateKey } from "./availability-check";

/**
 * Returns an error if the employee has approved time off covering any
 * local calendar day touched by [start, end).
 */
export async function approvedTimeOffConflictMessage(
  employeeId: string,
  start: Date,
  end: Date,
  timeZone?: string,
): Promise<string | null> {
  const startKey = localDateKey(start, timeZone);
  const endExclusive = new Date(end.getTime() - 1);
  const endKey = localDateKey(endExclusive, timeZone);

  // Date-only columns in DB — compare against UTC midnight of local keys
  const rangeStart = new Date(`${startKey}T00:00:00.000Z`);
  const rangeEnd = new Date(`${endKey}T00:00:00.000Z`);

  const hit = await prisma.timeOffRequest.findFirst({
    where: {
      employeeId,
      status: "approved",
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
    },
    select: { id: true, startDate: true, endDate: true, type: true },
  });

  if (!hit) return null;
  return "Employee has approved time off covering this day";
}

export type EligibilityReason =
  | "unavailable"
  | "conflict"
  | "time_off"
  | "outside_window"
  | "designation_mismatch"
  | null;

export function reasonFromAvailabilityMessage(
  message: string | null,
): EligibilityReason {
  if (!message) return null;
  if (message.includes("unavailable")) return "unavailable";
  if (message.includes("only available")) return "outside_window";
  if (message.includes("single day")) return "outside_window";
  return "unavailable";
}
