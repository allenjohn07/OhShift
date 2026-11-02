import { expect, test } from "bun:test";
import { clockEntriesRange, isInProgress, shiftRange, startOfWeek, toLocalDateInput } from "../src/lib/dates";
import { dayCount, formatDateRange } from "../src/lib/time-off";

test("shift forms roll overnight end times into the following calendar day", () => {
  const range = shiftRange("2035-01-31", "20:00", "04:00");
  expect(range).not.toBeNull();
  expect(toLocalDateInput(range!.start)).toBe("2035-01-31");
  expect(toLocalDateInput(range!.end)).toBe("2035-02-01");
  expect(range!.end.getHours()).toBe(4);
  const day = shiftRange("2035-01-31", "09:00", "17:00")!;
  expect(toLocalDateInput(day.end)).toBe("2035-01-31");
  for (const args of [["", "09:00", "17:00"], ["2035-01-31", "09:00", "09:00"], ["invalid", "09:00", "17:00"]]) {
    expect(shiftRange(args[0]!, args[1]!, args[2]!)).toBeNull();
  }
});
test("active shift boundaries include start and exclude end", () => {
  const shift = { start_time: "2035-02-01T20:00:00Z", end_time: "2035-02-02T04:00:00Z" };
  expect(isInProgress(shift, new Date(shift.start_time))).toBe(true);
  expect(isInProgress(shift, new Date("2035-02-02T01:00:00Z"))).toBe(true);
  expect(isInProgress(shift, new Date(shift.end_time))).toBe(false);
});
test("clock queries include yesterday for shifts crossing midnight", () => {
  const range = clockEntriesRange(new Date(2035, 1, 2, 1));
  const from = new Date(range.from), to = new Date(range.to);
  expect(toLocalDateInput(from)).toBe("2035-02-01");
  expect(toLocalDateInput(to)).toBe("2035-02-03");
  expect(from.getHours()).toBe(0);
  expect(to.getHours()).toBe(0);
});
test("default scheduling week starts Monday even when viewed on Sunday", () => {
  const sunday = new Date(2035, 0, 14, 14);
  const week = startOfWeek(sunday);
  expect(toLocalDateInput(week)).toBe("2035-01-08");
  expect(week.getHours()).toBe(0);
  expect(sunday.getHours()).toBe(14);
});
test("time off counts inclusive calendar days across leap days and daylight saving", () => {
  expect(dayCount("2036-02-28", "2036-03-01")).toBe(3);
  expect(dayCount("2026-03-07", "2026-03-09")).toBe(3);
  expect(dayCount("2035-01-01", "2035-01-01")).toBe(1);
  expect(formatDateRange("2035-01-01", "2035-01-01")).toBe("Jan 1, 2035");
  expect(formatDateRange("2035-01-31", "2035-02-02")).toBe("Jan 31 – Feb 2, 2035");
});
