/** Monday 00:00:00.000 UTC through next Monday (exclusive) for a YYYY-MM-DD week start. */
export function weekRangeFromStart(weekStart: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid weekStart date");
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/** Monday 00:00:00.000 UTC through 14 days later (exclusive) for a YYYY-MM-DD biweek start. */
export function biweekRangeFromStart(weekStart: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid weekStart date");
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14);
  return { start, end };
}
