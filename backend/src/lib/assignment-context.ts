import { and, eq, gt, gte, lt, lte } from "drizzle-orm";
import { db } from "../db";
import {
  availabilityWindows,
  shifts,
  timeOffRequests,
  users,
} from "../db/schema";
import type { AvailabilityWindowLike } from "./availability-check";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ContextShift = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
};

/**
 * Everything shift validation needs for one company + time range, loaded in a
 * single D1 batch. Validation then runs in memory, so bulk assign / eligibility
 * cost one round trip instead of several queries per person (D1 caps queries
 * per Worker invocation).
 */
export type AssignmentContext = {
  /** userId → dayOfWeek → window */
  windows: Map<string, Map<number, AvailabilityWindowLike>>;
  /** userId → approved time off */
  timeOff: Map<string, { startDate: Date; endDate: Date }[]>;
  /** userId → shifts overlapping the loaded range */
  shifts: Map<string, ContextShift[]>;
};

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export async function loadAssignmentContext(
  companyId: string,
  from: Date,
  to: Date,
): Promise<AssignmentContext> {
  // Time-off dates are local calendar days; pad for timezone offsets.
  const padFrom = new Date(from.getTime() - 2 * DAY_MS);
  const padTo = new Date(to.getTime() + 2 * DAY_MS);

  const [windowRows, timeOffRows, shiftRows] = await db.batch([
    db
      .select({
        userId: availabilityWindows.userId,
        dayOfWeek: availabilityWindows.dayOfWeek,
        isAvailable: availabilityWindows.isAvailable,
        startTime: availabilityWindows.startTime,
        endTime: availabilityWindows.endTime,
      })
      .from(availabilityWindows)
      .innerJoin(users, eq(users.id, availabilityWindows.userId))
      .where(eq(users.companyId, companyId)),
    db
      .select({
        employeeId: timeOffRequests.employeeId,
        startDate: timeOffRequests.startDate,
        endDate: timeOffRequests.endDate,
      })
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.companyId, companyId),
          eq(timeOffRequests.status, "approved"),
          lte(timeOffRequests.startDate, padTo),
          gte(timeOffRequests.endDate, padFrom),
        ),
      ),
    db
      .select({
        id: shifts.id,
        employeeId: shifts.employeeId,
        title: shifts.title,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.companyId, companyId),
          lt(shifts.startTime, to),
          gt(shifts.endTime, from),
        ),
      ),
  ]);

  const ctx: AssignmentContext = {
    windows: new Map(),
    timeOff: new Map(),
    shifts: new Map(),
  };

  for (const w of windowRows) {
    let byDay = ctx.windows.get(w.userId);
    if (!byDay) {
      byDay = new Map();
      ctx.windows.set(w.userId, byDay);
    }
    byDay.set(w.dayOfWeek, w);
  }
  for (const t of timeOffRows) pushTo(ctx.timeOff, t.employeeId, t);
  for (const s of shiftRows) pushTo(ctx.shifts, s.employeeId, s);

  return ctx;
}

/** Record a shift created mid-request so later checks in the same batch see it. */
export function addShiftToContext(
  ctx: AssignmentContext,
  employeeId: string,
  shift: ContextShift,
) {
  pushTo(ctx.shifts, employeeId, shift);
}
