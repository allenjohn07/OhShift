import { db } from "../db";
import { shiftLogs, type ShiftLogAction } from "../db/schema";

type ShiftLogInput = {
  companyId: string;
  actorId: string;
  action: ShiftLogAction;
  detail: string;
  shiftId?: string | null;
  weekStart?: string | null;
};

/** Insert statement for a shift log — await it, or pass it to db.batch(). */
export function shiftLogInsert(opts: ShiftLogInput) {
  return db.insert(shiftLogs).values({
    companyId: opts.companyId,
    actorId: opts.actorId,
    action: opts.action,
    detail: opts.detail,
    shiftId: opts.shiftId ?? null,
    weekStart: opts.weekStart ?? null,
  });
}

export async function logShiftAction(opts: ShiftLogInput) {
  await shiftLogInsert(opts);
}
