import { getDisplayPrefs } from "@/lib/display-prefs";

/** Local calendar date as YYYY-MM-DD (for date pickers). */
export function toLocalDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local wall-clock time as HH:mm (24h). */
export function toLocalTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → local midnight Date (null if malformed). */
export function parseDateInput(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Intl options for a clock time in the user's 12h/24h preference. */
export function timeFormatOptions(): Intl.DateTimeFormatOptions {
  return getDisplayPrefs().timeFormat === "24h"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "numeric", minute: "2-digit", hour12: true };
}

/** "1:30 PM" or "13:30", per the user's preference. */
export function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", timeFormatOptions()).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

/** Compact time for dense chips: "7 am" / "7:30 am", or "07:00" in 24h. */
export function formatTimeShort(value: Date | string) {
  const label = formatTime(value);
  if (getDisplayPrefs().timeFormat === "24h") return label;
  return label.replace(":00", "").toLowerCase();
}

/** "13:30" → "1:30 PM" (or "13:30" in 24h) */
export function formatTimeLabel(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return formatTime(new Date(2000, 0, 1, Number(m[1]), Number(m[2])));
}

/** 0 = Sunday … 6 = Saturday: the first day of the week for this user. */
export function weekStartDay() {
  return getDisplayPrefs().weekStartsOn === "sunday" ? 0 : 1;
}

/** Local midnight on the first day of the week containing `date`. */
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - weekStartDay() + 7) % 7));
  return d;
}

/** Weekday labels in display order, e.g. ["Mon", …, "Sun"] or ["Sun", …, "Sat"]. */
export function weekdayLabels(style: "short" | "narrow" | "long" = "short") {
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: style });
  // Jan 2, 2000 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(2000, 0, 2 + ((weekStartDay() + i) % 7))),
  );
}
