import "../ai/harness";
import { expect, test } from "bun:test";
import type { AssignmentContext } from "../../src/lib/assignment-context";
const { validateShiftAssignment } = await import("../../src/lib/shift-create");
const empty = (): AssignmentContext => ({ windows: new Map(), timeOff: new Map(), shifts: new Map() });
const start = new Date("2035-01-08T09:00:00Z");
const end = new Date("2035-01-08T12:00:00Z");
const options = { employeeId: "worker", start, end, timezone: "UTC" };

test("assignment rejects unavailable days and times outside availability", () => {
  const ctx = empty();
  const windows = new Map([[0, { dayOfWeek: 0, isAvailable: false, startTime: "09:00", endTime: "17:00" }]]);
  ctx.windows.set("worker", windows);
  expect(validateShiftAssignment(ctx, options)?.reason).toBe("unavailable");
  windows.set(0, { dayOfWeek: 0, isAvailable: true, startTime: "10:00", endTime: "17:00" });
  expect(validateShiftAssignment(ctx, options)?.reason).toBe("outside_window");
  windows.set(0, { dayOfWeek: 0, isAvailable: true, startTime: "09:00", endTime: "17:00" });
  expect(validateShiftAssignment(ctx, options)).toBeNull();
});
test("assignment blocks approved leave including overnight crossings", () => {
  const ctx = empty();
  ctx.timeOff.set("worker", [{ startDate: new Date("2035-01-09T00:00:00Z"), endDate: new Date("2035-01-09T00:00:00Z") }]);
  expect(validateShiftAssignment(ctx, options)).toBeNull();
  expect(validateShiftAssignment(ctx, { ...options, start: new Date("2035-01-08T22:00:00Z"), end: new Date("2035-01-09T04:00:00Z") })?.reason).toBe("time_off");
});
test("assignment ignores the edited shift but detects other overlaps", () => {
  const ctx = empty();
  ctx.shifts.set("worker", [{ id: "existing", title: "Existing", startTime: start, endTime: end }]);
  expect(validateShiftAssignment(ctx, options)?.status).toBe(409);
  expect(validateShiftAssignment(ctx, { ...options, excludeShiftId: "existing" })).toBeNull();
  expect(validateShiftAssignment(ctx, { ...options, start: end, end: new Date("2035-01-08T14:00:00Z") })).toBeNull();
});
test("assignment rejects reversed times, invalid dates and shifts over 24 hours", () => {
  for (const times of [{ start: end, end: start }, { start, end: start }, { start: new Date("invalid"), end }, { start, end: new Date("2035-01-09T10:00:00Z") }]) {
    expect(validateShiftAssignment(empty(), { ...options, ...times })?.reason).toBe("invalid");
  }
});
