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

/** True when an end time at or before the start means the next morning. */
export function endsNextDay(startTime: string, endTime: string) {
  return Boolean(startTime && endTime) && endTime <= startTime;
}

/**
 * Local start/end for a shift that starts on `date` ("YYYY-MM-DD", times "HH:mm").
 * An end at or before the start is a night shift ending the next day
 * (20:00–04:00, or 16:00–00:00). Null if incomplete or start === end.
 */
export function shiftRange(date: string, startTime: string, endTime: string) {
  if (!date || !startTime || !endTime || startTime === endTime) return null;
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Range for "today's" clock entries: from yesterday's midnight so a night shift
 * clocked in last evening is still found after midnight. Shared by the
 * dashboard clock card and the Hours page (same query key → one cache entry).
 */
export function clockEntriesRange(now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 1);
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** A shift running right now (e.g. a night shift that started yesterday). */
export function isInProgress(shift: { start_time: string; end_time: string }, now = new Date()) {
  return new Date(shift.start_time) <= now && now < new Date(shift.end_time);
}
