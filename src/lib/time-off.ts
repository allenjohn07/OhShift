/** Shared time-off labels, Notion tag colors and date helpers (Requests + Time off). */
export type TimeOffType = "vacation" | "sick" | "personal" | "other";
export type TimeOffStatus = "pending" | "approved" | "denied" | "cancelled";

export const TIME_OFF_TYPE_LABELS: Record<TimeOffType, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

export const TIME_OFF_TYPE_STYLES: Record<TimeOffType, string> = {
  vacation: "bg-[#d3e5ef] text-[#183347] dark:bg-[#1f3a52] dark:text-[#b9dcf3]",
  sick: "bg-[#ffe2dd] text-[#5d1715] dark:bg-[#4a2321] dark:text-[#f5c2bd]",
  personal: "bg-[#e8deee] text-[#412454] dark:bg-[#3a2a4a] dark:text-[#ddc7f0]",
  other: "bg-[#e3e2e0] text-[#32302c] dark:bg-[#373737] dark:text-[#d4d4d4]",
};

export const TIME_OFF_STATUS_STYLES: Record<TimeOffStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  denied: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

/** "Nov 4, 2026" or "Nov 5 – Nov 7, 2026" for YYYY-MM-DD dates. */
export function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  const withYear = new Intl.DateTimeFormat("en-US", { ...opts, year: "numeric" });
  if (start === end) return withYear.format(s);
  return `${new Intl.DateTimeFormat("en-US", opts).format(s)} – ${withYear.format(e)}`;
}

/** Inclusive number of calendar days in a YYYY-MM-DD range. */
export function dayCount(start: string, end: string) {
  const ms =
    new Date(`${end}T00:00:00.000Z`).getTime() -
    new Date(`${start}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Today's local date as YYYY-MM-DD. */
export function localToday() {
  return new Date().toLocaleDateString("en-CA");
}
