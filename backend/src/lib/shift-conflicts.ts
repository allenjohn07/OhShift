import type { AssignmentContext } from "./assignment-context";

/** Returns shifts that overlap [startTime, endTime) for the same employee. */
export function findOverlappingShifts(
  ctx: AssignmentContext,
  employeeId: string,
  startTime: Date,
  endTime: Date,
  excludeShiftId?: string,
) {
  if (startTime >= endTime) {
    return [];
  }

  return (ctx.shifts.get(employeeId) ?? [])
    .filter(
      (s) =>
        s.id !== excludeShiftId &&
        s.startTime < endTime &&
        s.endTime > startTime,
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/** Same person + identical start instant — blocked even if ranges would somehow differ. */
export function findShiftWithSameStart(
  ctx: AssignmentContext,
  employeeId: string,
  startTime: Date,
  excludeShiftId?: string,
) {
  return (
    (ctx.shifts.get(employeeId) ?? []).find(
      (s) =>
        s.id !== excludeShiftId &&
        s.startTime.getTime() === startTime.getTime(),
    ) ?? null
  );
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
