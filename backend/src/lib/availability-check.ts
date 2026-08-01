/** Availability helpers — dayOfWeek 0 = Monday … 6 = Sunday (matches Prisma). */

function isHhMm(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

const WEEKDAY_TO_OH: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** OhShift dayOfWeek for a timestamp in an optional IANA timezone. */
export function ohShiftDayOfWeek(date: Date, timeZone?: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || undefined,
    weekday: "short",
  }).format(date);
  return WEEKDAY_TO_OH[weekday] ?? 0;
}

/** Local calendar YYYY-MM-DD for a timestamp. */
export function localDateKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Local HH:mm (24h) for a timestamp. */
export function localHhMm(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone || undefined,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

export type AvailabilityWindowLike = {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

/**
 * Returns an error message if the shift conflicts with availability,
 * or null if allowed. Missing windows = available (default week).
 */
export function availabilityConflictMessage(
  window: AvailabilityWindowLike | null | undefined,
  start: Date,
  end: Date,
  timeZone?: string,
): string | null {
  const startDay = localDateKey(start, timeZone);
  const endDay = localDateKey(end, timeZone);
  if (startDay !== endDay) {
    return "Shift must stay on a single day to match the employee's availability";
  }

  // No saved window → employee uses defaults (available)
  if (!window) return null;

  if (!window.isAvailable) {
    return "Employee is marked unavailable on this day";
  }

  if (!isHhMm(window.startTime) || !isHhMm(window.endTime)) {
    return null;
  }

  const shiftStart = toMinutes(localHhMm(start, timeZone));
  const shiftEnd = toMinutes(localHhMm(end, timeZone));
  const availStart = toMinutes(window.startTime);
  const availEnd = toMinutes(window.endTime);

  if (shiftStart < availStart || shiftEnd > availEnd) {
    return `Employee is only available ${window.startTime}–${window.endTime} on this day`;
  }

  return null;
}
