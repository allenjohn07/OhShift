/** Drizzle wraps D1/SQLite errors in causes. Expose only known invariant messages. */
export function databaseConflict(error: unknown): string | null {
  let current = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (current.message.includes("OHSHIFT_HISTORY_PROTECTED")) return "This change would remove historical time records or strand an open clock-in and is not allowed.";
    if (current.message.includes("OHSHIFT_INACTIVE_EMPLOYEE")) return "This employee is no longer active in this company.";
    if (current.message.includes("OHSHIFT_TIME_OFF_CONFLICT")) return "This overlaps an existing pending or approved time-off request.";
    if (current.message.includes("OHSHIFT_SHIFT_CONFLICT")) return "This employee already has an overlapping shift. Refresh and try again.";
    if (current.message.includes("OHSHIFT_CLOCK_CONFLICT")) return "You already have an open clock-in. Clock out first.";
    if (current.message.includes("UNIQUE constraint failed: time_entries.shift_id")) return "This shift already has a time entry.";
    current = current.cause;
  }
  return null;
}
