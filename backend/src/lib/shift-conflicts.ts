import { prisma } from "./prisma";

/** Returns shifts that overlap [startTime, endTime) for the same employee. */
export async function findOverlappingShifts(
  employeeId: string,
  startTime: Date,
  endTime: Date,
  excludeShiftId?: string,
) {
  if (startTime >= endTime) {
    return [];
  }

  return prisma.shift.findMany({
    where: {
      employeeId,
      ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: {
      employee: { select: { fullName: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

/** Same person + identical start instant — blocked even if ranges would somehow differ. */
export async function findShiftWithSameStart(
  employeeId: string,
  startTime: Date,
  excludeShiftId?: string,
) {
  return prisma.shift.findFirst({
    where: {
      employeeId,
      startTime,
      ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
    },
    include: {
      employee: { select: { fullName: true } },
    },
  });
}

function formatLocalRange(start: Date, end: Date): string {
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function formatSameStartMessage(shift: {
  title: string;
  startTime: Date;
  endTime: Date;
}): string {
  return `This person already has a shift starting at that time (“${shift.title}”, ${formatLocalRange(shift.startTime, shift.endTime)}). Pick a different start time.`;
}

export function formatConflictMessage(
  conflicts: Array<{ title: string; startTime: Date; endTime: Date }>,
): string {
  if (conflicts.length === 0) {
    return "Shift conflicts with an existing assignment";
  }
  const first = conflicts[0];
  const extra =
    conflicts.length > 1 ? ` (+${conflicts.length - 1} more)` : "";
  return `Shift overlaps with “${first.title}” (${formatLocalRange(first.startTime, first.endTime)})${extra}`;
}
