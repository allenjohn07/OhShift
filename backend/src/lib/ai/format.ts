/** "08:00" → "8:00 AM", "00:00" → "12:00 AM" */
export function fmt12(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** OhShift day index: 0 = Monday … 6 = Sunday. */
export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

/** 18.5 hours → "18h 30m" */
export function formatMinutes(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "Nov 10" for a date-only timestamp stored as UTC midnight. */
export function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateRangeOnly(start: Date, end: Date): string {
  return start.getTime() === end.getTime()
    ? formatDateOnly(start)
    : `${formatDateOnly(start)}–${formatDateOnly(end)}`;
}
