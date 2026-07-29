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

export function formatConflictMessage(
  conflicts: Array<{ title: string; startTime: Date; endTime: Date }>,
): string {
  if (conflicts.length === 0) return "Shift conflicts with an existing assignment";
  const first = conflicts[0];
  const start = first.startTime.toISOString();
  const end = first.endTime.toISOString();
  const extra =
    conflicts.length > 1 ? ` (+${conflicts.length - 1} more)` : "";
  return `Shift overlaps with "${first.title}" (${start} – ${end})${extra}`;
}
