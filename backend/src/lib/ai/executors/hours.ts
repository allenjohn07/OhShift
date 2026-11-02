import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "../../../db";
import { timeEntries } from "../../../db/schema";
import {
  formatWindowLabel,
  localParts,
  resolveQueryRange,
  thisWeekRange,
} from "../../nl-schedule-ask";
import { zonedLocalToDate } from "../../nl-shift-parse";
import { formatMinutes } from "../format";
import { findPeople, joinNames } from "../slots";
import { help, queryResult, type AskResult, type ExecContext } from "../types";
import { hasDateCue, refersToSelf } from "./shifts";

type Window = { start: Date; end: Date; label: string };

/** "this month" / "last month" / any date cue; otherwise the current week. */
function hoursWindow(ctx: ExecContext): Window {
  const lower = ctx.prompt.toLowerCase();
  const p = localParts(ctx.now, ctx.timezone);
  const month = (offset: number, prefix: string): Window => {
    const start = zonedLocalToDate(p.y, p.m + offset, 1, 0, 0, ctx.timezone);
    const end = zonedLocalToDate(p.y, p.m + offset + 1, 1, 0, 0, ctx.timezone);
    return { start, end, label: formatWindowLabel(start, end, ctx.timezone, prefix) };
  };
  if (/\bthis month\b/.test(lower)) return month(0, "This month");
  if (/\blast month\b/.test(lower)) return month(-1, "Last month");
  if (hasDateCue(ctx.prompt)) return resolveQueryRange(ctx.prompt, {}, ctx.timezone);
  const w = thisWeekRange(ctx.timezone);
  return { ...w, label: formatWindowLabel(w.start, w.end, ctx.timezone, "This week") };
}

/**
 * Only clock-in/out times and status are selected: never the reviewer's note.
 * Denied entries don't count as worked time.
 */
async function loadEntries(
  ctx: ExecContext,
  window: Window,
  employeeIds: string[] | null,
) {
  const rows = await db
    .select({
      employeeId: timeEntries.employeeId,
      clockInAt: timeEntries.clockInAt,
      clockOutAt: timeEntries.clockOutAt,
      status: timeEntries.status,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.companyId, ctx.principal.companyId),
        employeeIds ? inArray(timeEntries.employeeId, employeeIds) : undefined,
        gte(timeEntries.clockInAt, window.start),
        lt(timeEntries.clockInAt, window.end),
        isNotNull(timeEntries.clockOutAt),
      ),
    )
    .limit(500);
  return rows.filter((r) => r.status !== "denied");
}

const minutes = (r: { clockInAt: Date; clockOutAt: Date | null }) =>
  r.clockOutAt ? Math.max(0, (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 60_000) : 0;

function summarize(rows: Awaited<ReturnType<typeof loadEntries>>) {
  const total = rows.reduce((sum, r) => sum + minutes(r), 0);
  const pending = rows.filter((r) => r.status === "pending").length;
  return { total, pending, count: rows.length };
}

/** "How many hours did I work this week?" */
export async function runMyHours(ctx: ExecContext): Promise<AskResult> {
  const window = hoursWindow(ctx);
  const rows = await loadEntries(ctx, window, [ctx.principal.userId]);
  const { total, pending, count } = summarize(rows);
  if (count === 0) {
    return queryResult({
      answer: `You have no recorded hours for ${window.label}.`,
      window_label: window.label,
    });
  }
  const note = pending
    ? ` ${pending} ${pending === 1 ? "timesheet is" : "timesheets are"} still waiting for approval.`
    : "";
  return queryResult({
    answer: `You worked ${formatMinutes(total)} across ${count} ${count === 1 ? "shift" : "shifts"} for ${window.label}.${note}`,
    window_label: window.label,
  });
}

/** "How many hours did Sam work?" / "Who is clocked in?" / "Any timesheets to approve?" */
export async function runTeamHours(ctx: ExecContext): Promise<AskResult> {
  const { prompt, team, principal } = ctx;
  const nameOf = (id: string) => team.find((m) => m.id === id)?.fullName ?? "Someone";

  // Who is on the clock right now?
  if (/\b(clocked in|on the clock|clock(?:ed)? in right now|currently working)\b/i.test(prompt)) {
    const open = await db
      .select({ employeeId: timeEntries.employeeId })
      .from(timeEntries)
      .where(and(eq(timeEntries.companyId, principal.companyId), eq(timeEntries.status, "open")))
      .limit(100);
    const names = [...new Set(open.map((o) => nameOf(o.employeeId)))];
    return queryResult({
      answer: names.length
        ? `Clocked in right now: ${joinNames(names)}.`
        : "No one is clocked in right now.",
      window_label: "Right now",
    });
  }

  // Timesheets waiting for approval
  if (/\b(pending|approve|approval|waiting|review|to approve)\b/i.test(prompt)) {
    const pending = await db
      .select({ employeeId: timeEntries.employeeId })
      .from(timeEntries)
      .where(and(eq(timeEntries.companyId, principal.companyId), eq(timeEntries.status, "pending")))
      .limit(100);
    const names = [...new Set(pending.map((p) => nameOf(p.employeeId)))];
    return queryResult({
      answer: pending.length
        ? `${pending.length} ${pending.length === 1 ? "timesheet is" : "timesheets are"} waiting for approval (${joinNames(names)}).`
        : "No timesheets are waiting for approval.",
      window_label: "Timesheets",
    });
  }

  const { people, ambiguous } = findPeople(prompt, team);
  if (ambiguous.length > 0) {
    return help(
      `Which one do you mean: ${joinNames(ambiguous.map((a) => a.fullName))}?`,
      ambiguous.map((a) => `How many hours did ${a.fullName} work this week?`),
    );
  }
  if (people.length === 0 && refersToSelf(prompt)) return runMyHours(ctx);

  const window = hoursWindow(ctx);
  const rows = await loadEntries(ctx, window, people.length ? people.map((p) => p.id) : null);

  if (people.length > 0) {
    const person = people[0]!;
    const { total, pending, count } = summarize(rows.filter((r) => r.employeeId === person.id));
    return queryResult({
      answer: count
        ? `${person.fullName} worked ${formatMinutes(total)} across ${count} ${count === 1 ? "shift" : "shifts"} for ${window.label}${pending ? ` (${pending} pending approval)` : ""}.`
        : `${person.fullName} has no recorded hours for ${window.label}.`,
      window_label: window.label,
      person: person.fullName,
    });
  }

  if (rows.length === 0) {
    return queryResult({
      answer: `No hours are recorded for ${window.label}.`,
      window_label: window.label,
    });
  }
  const perPerson = new Map<string, number>();
  for (const r of rows) perPerson.set(r.employeeId, (perPerson.get(r.employeeId) ?? 0) + minutes(r));
  const top = [...perPerson.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, mins]) => `${nameOf(id)} ${formatMinutes(mins)}`);
  const { total } = summarize(rows);
  return queryResult({
    answer: `The team worked ${formatMinutes(total)} for ${window.label}. Most hours: ${top.join("; ")}.`,
    window_label: window.label,
  });
}
