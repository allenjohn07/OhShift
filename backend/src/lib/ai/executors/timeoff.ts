import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../../../db";
import { timeOffRequests } from "../../../db/schema";
import { localYmd } from "../../nl-schedule-ask";
import { formatDateRangeOnly } from "../format";
import { findPeople, joinNames } from "../slots";
import { help, queryResult, type AskResult, type ExecContext } from "../types";
import { hasDateCue, refersToSelf, upcomingWindow } from "./shifts";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Only dates, type and status ever leave this module. The request `note` and the
 * reviewer's details are never selected, so they can't reach an answer.
 */
async function loadRequests(
  ctx: ExecContext,
  window: { start: Date; end: Date },
  employeeIds: string[] | null,
  statuses: Array<"pending" | "approved">,
) {
  // Time-off dates are date-only (UTC midnight of the local calendar day).
  const first = new Date(`${localYmd(window.start, ctx.timezone)}T00:00:00.000Z`);
  const last = new Date(
    `${localYmd(new Date(window.end.getTime() - 1), ctx.timezone)}T00:00:00.000Z`,
  );
  return db
    .select({
      employeeId: timeOffRequests.employeeId,
      type: timeOffRequests.type,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      status: timeOffRequests.status,
    })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.companyId, ctx.principal.companyId),
        employeeIds ? inArray(timeOffRequests.employeeId, employeeIds) : undefined,
        inArray(timeOffRequests.status, statuses),
        lte(timeOffRequests.startDate, last),
        gte(timeOffRequests.endDate, first),
      ),
    )
    .orderBy(asc(timeOffRequests.startDate))
    .limit(50);
}

const line = (r: { type: string; startDate: Date; endDate: Date; status: string }) =>
  `${cap(r.type)} ${formatDateRangeOnly(r.startDate, r.endDate)} (${r.status})`;

/** "Do I have time off booked?" (anyone, own requests only) */
export async function runMyTimeOff(ctx: ExecContext): Promise<AskResult> {
  // Own requests from a month ago through the next year unless a date is given.
  const window = hasDateCue(ctx.prompt)
    ? upcomingWindow(ctx)
    : {
        start: new Date(ctx.now.getTime() - 30 * 86_400_000),
        end: new Date(ctx.now.getTime() + 365 * 86_400_000),
        label: "Your time off",
      };
  const rows = await loadRequests(ctx, window, [ctx.principal.userId], ["pending", "approved"]);
  if (rows.length === 0) {
    return queryResult({
      answer: "You have no pending or approved time off for that period.",
      window_label: window.label,
    });
  }
  return queryResult({
    answer: `You have ${rows.length} time-off ${rows.length === 1 ? "request" : "requests"}: ${rows.map(line).join("; ")}.`,
    window_label: window.label,
  });
}

/** "Who is off next week?" (managers only) */
export async function runTeamTimeOff(ctx: ExecContext): Promise<AskResult> {
  const { people, ambiguous } = findPeople(ctx.prompt, ctx.team);
  if (ambiguous.length > 0) {
    return help(
      `Which one do you mean: ${joinNames(ambiguous.map((a) => a.fullName))}?`,
      ambiguous.map((a) => `Does ${a.fullName} have time off next week?`),
    );
  }
  if (people.length === 0 && refersToSelf(ctx.prompt)) return runMyTimeOff(ctx);

  const window = upcomingWindow(ctx);
  const rows = await loadRequests(
    ctx,
    window,
    people.length ? people.map((p) => p.id) : null,
    ["pending", "approved"],
  );
  const nameOf = (id: string) => ctx.team.find((m) => m.id === id)?.fullName ?? "Someone";

  if (rows.length === 0) {
    return queryResult({
      answer: people.length
        ? `${joinNames(people.map((p) => p.fullName))} has no time off for ${window.label}.`
        : `No one has pending or approved time off for ${window.label}.`,
      window_label: window.label,
      person: people.length === 1 ? people[0]!.fullName : null,
    });
  }
  const approved = rows.filter((r) => r.status === "approved");
  const pending = rows.filter((r) => r.status === "pending");
  const fmt = (rs: typeof rows) => rs.map((r) => `${nameOf(r.employeeId)} (${line(r)})`).join("; ");
  const parts = [
    approved.length ? `Approved time off: ${fmt(approved)}.` : "",
    pending.length ? `Waiting for review: ${fmt(pending)}.` : "",
  ].filter(Boolean);
  return queryResult({
    answer: `${window.label}. ${parts.join(" ")}`,
    window_label: window.label,
    person: people.length === 1 ? people[0]!.fullName : null,
  });
}
