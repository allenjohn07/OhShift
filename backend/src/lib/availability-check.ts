/** Availability helpers — dayOfWeek 0 = Monday … 6 = Sunday (matches the DB schema). */

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

const DAY_MINUTES = 24 * 60;

/**
 * A window's [start, end) in minutes from its own day's midnight. An end at or
 * before the start is overnight and runs into the next morning (e.g. 20:00–04:00).
 */
function windowMinutes(window: AvailabilityWindowLike): [number, number] {
  const start = toMinutes(window.startTime);
  let end = toMinutes(window.endTime);
  if (end <= start) end += DAY_MINUTES;
  return [start, end];
}

function windowLabel(window: AvailabilityWindowLike) {
  const overnight = toMinutes(window.endTime) <= toMinutes(window.startTime);
  return `${window.startTime}–${window.endTime}${overnight ? " (overnight)" : ""}`;
}

/**
 * Returns an error message if the shift conflicts with availability, or null if
 * allowed. Missing windows = available (default week). Night shifts are fine:
 * the shift must fit the start day's window (overnight windows included), or an
 * early-morning shift may fit the previous day's overnight window.
 */
export function availabilityConflictMessage(
  windows: {
    /** Window for the shift's start day */
    day: AvailabilityWindowLike | null | undefined;
    /** Window for the day before (its overnight part can cover early mornings) */
    previousDay?: AvailabilityWindowLike | null;
  },
  start: Date,
  end: Date,
  timeZone?: string,
): string | null {
  const { day, previousDay } = windows;
  // No saved window → employee uses defaults (available)
  if (!day) return null;
  if (!isHhMm(day.startTime) || !isHhMm(day.endTime)) return null;

  // Shift in minutes from its start day's midnight; past 1440 = next morning.
  const shiftStart = toMinutes(localHhMm(start, timeZone));
  const shiftEnd = shiftStart + Math.round((end.getTime() - start.getTime()) / 60_000);

  const fits = (window: AvailabilityWindowLike | null | undefined, offset: number) => {
    if (!window?.isAvailable) return false;
    if (!isHhMm(window.startTime) || !isHhMm(window.endTime)) return false;
    const [from, to] = windowMinutes(window);
    return shiftStart >= from + offset && shiftEnd <= to + offset;
  };

  if (fits(day, 0) || fits(previousDay, -DAY_MINUTES)) return null;

  if (!day.isAvailable) {
    return "Employee is marked unavailable on this day";
  }
  return `Employee is only available ${windowLabel(day)} on this day`;
}
