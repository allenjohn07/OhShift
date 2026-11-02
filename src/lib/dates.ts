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

const timeLabelFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** "13:30" → "1:30 PM" */
export function formatTimeLabel(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return timeLabelFmt.format(new Date(2000, 0, 1, Number(m[1]), Number(m[2])));
}
