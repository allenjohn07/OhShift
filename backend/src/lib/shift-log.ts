import type { ShiftLogAction } from "@prisma/client";
import { prisma } from "./prisma";

export async function logShiftAction(opts: {
  companyId: string;
  actorId: string;
  action: ShiftLogAction;
  detail: string;
  shiftId?: string | null;
  weekStart?: string | null;
}) {
  await prisma.shiftLog.create({
    data: {
      companyId: opts.companyId,
      actorId: opts.actorId,
      action: opts.action,
      detail: opts.detail,
      shiftId: opts.shiftId ?? null,
      weekStart: opts.weekStart ?? null,
    },
  });
}
