import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { availabilityWindows } from "../../../db/schema";
import { loadAssignmentContext } from "../../assignment-context";
import { availabilityConflictMessage, type AvailabilityWindowLike } from "../../availability-check";
import { formatSingleDayLabel, resolvePartOfDay } from "../../nl-schedule-ask";
import { extractDateFromPrompt, zonedLocalToDate } from "../../nl-shift-parse";
import { evaluateEligibility } from "../../shift-create";
import { DAY_NAMES, fmt12 } from "../format";
import { findPeople, joinNames } from "../slots";
import {
  help,
  isManagerPrincipal,
  queryResult,
  type AskResult,
  type ExecContext,
  type TeamMember,
} from "../types";
import { hasDateCue, refersToSelf } from "./shifts";

const hhmm = (v: string) => /^(\d{2}):(\d{2})$/.exec(v);

/** Local start/end of a preset on a calendar day (overnight presets end next day). */
function presetRange(
  date: { y: number; m: number; d: number },
  startTime: string,
  endTime: string,
  timeZone: string,
) {
  const s = hhmm(startTime);
  const e = hhmm(endTime);
  if (!s || !e) return null;
  const overnight = endTime <= startTime;
  return {
    start: zonedLocalToDate(date.y, date.m, date.d, Number(s[1]), Number(s[2]), timeZone),
    end: zonedLocalToDate(
      date.y,
      date.m,
      date.d + (overnight ? 1 : 0),
      Number(e[1]),
      Number(e[2]),
      timeZone,
    ),
  };
}

const dayIndex = (date: { y: number; m: number; d: number }) =>
  (new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay() + 6) % 7;

function describeWindow(w: AvailabilityWindowLike | undefined): string {
  if (!w) return "not set (counts as available)";
  if (!w.isAvailable) return "unavailable";
  const overnight = w.endTime <= w.startTime;
  return `${fmt12(w.startTime)}–${fmt12(w.endTime)}${overnight ? " (overnight)" : ""}`;
}

/** "Is Sam available Friday?" / "What is my availability?" */
export async function runAvailability(ctx: ExecContext): Promise<AskResult> {
  const { principal, team, prompt, timezone } = ctx;
  const named = findPeople(prompt, team);
  if (named.ambiguous.length > 0) {
    return help(
      `Which one do you mean: ${joinNames(named.ambiguous.map((a) => a.fullName))}?`,
      named.ambiguous.map((a) => `Is ${a.fullName} available Friday?`),
    );
  }

  const me = team.find((m) => m.id === principal.userId);
  let target: TeamMember | undefined = named.people[0];
  if (!target) {
    if (refersToSelf(prompt) || !isManagerPrincipal(principal)) target = me;
    else {
      return help("Whose availability do you mean?", [
        "Is Priya available Friday?",
        "Who can work Saturday evening?",
      ]);
    }
  }
  if (!target) return help("I couldn't find that person on your team.");

  const isSelf = target.id === principal.userId;
  if (!isManagerPrincipal(principal) && !isSelf) {
    return help("I can only share your own availability. Managers can see the whole team's.", [
      "What is my availability?",
      "When do I work next?",
    ]);
  }

  const rows = await db
    .select({
      dayOfWeek: availabilityWindows.dayOfWeek,
      isAvailable: availabilityWindows.isAvailable,
      startTime: availabilityWindows.startTime,
      endTime: availabilityWindows.endTime,
    })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.userId, target.id));
  const byDay = new Map<number, AvailabilityWindowLike>(rows.map((r) => [r.dayOfWeek, r]));
  const who = isSelf ? "You" : target.fullName;
  const poss = isSelf ? "Your" : `${target.fullName}'s`;

  const date = hasDateCue(prompt) ? extractDateFromPrompt(prompt, timezone) : null;
  if (!date) {
    const lines = DAY_NAMES.map((d, i) => `${d.slice(0, 3)} ${describeWindow(byDay.get(i))}`);
    return queryResult({
      answer: `${poss} weekly availability: ${lines.join("; ")}.`,
      window_label: "Availability",
      person: isSelf ? null : target.fullName,
    });
  }

  const idx = dayIndex(date);
  const label = formatSingleDayLabel(date.y, date.m, date.d, timezone);
  const part = resolvePartOfDay(prompt);
  if (part === "any") {
    return queryResult({
      answer: `${who} ${isSelf ? "are" : "is"} on ${DAY_NAMES[idx]}: ${describeWindow(byDay.get(idx))}.`,
      window_label: label,
      person: isSelf ? null : target.fullName,
    });
  }

  const range =
    part === "morning"
      ? presetRange(date, ctx.presets.morning_start, ctx.presets.morning_end, timezone)
      : presetRange(date, ctx.presets.evening_start, ctx.presets.evening_end, timezone);
  if (!range) return help("I couldn't read the shift times for that.");
  const problem = availabilityConflictMessage(
    { day: byDay.get(idx), previousDay: byDay.get((idx + 6) % 7) },
    range.start,
    range.end,
    timezone,
  );
  return queryResult({
    answer: problem
      ? `No. ${problem.replace(/^Employee/, who)}.`.replace(/\.\.$/, ".")
      : `Yes, ${isSelf ? "you are" : `${target.fullName} is`} available for the ${part} shift on ${label}.`,
    window_label: label,
    person: isSelf ? null : target.fullName,
  });
}

/** "Who can work Saturday evening?" (managers only; same rules as Assign shifts) */
export async function runWhoIsAvailable(ctx: ExecContext): Promise<AskResult> {
  const { team, prompt, timezone, presets, principal } = ctx;
  const date = hasDateCue(prompt) ? extractDateFromPrompt(prompt, timezone) : null;
  if (!date) {
    return help("Which day? For example: Who can work Saturday evening?", [
      "Who is available Friday?",
      "Who can work tomorrow morning?",
    ]);
  }

  const part = resolvePartOfDay(prompt);
  const windows = [
    ...(part !== "evening"
      ? [{ name: "morning", r: presetRange(date, presets.morning_start, presets.morning_end, timezone) }]
      : []),
    ...(part !== "morning"
      ? [{ name: "evening", r: presetRange(date, presets.evening_start, presets.evening_end, timezone) }]
      : []),
  ].filter((w): w is { name: string; r: NonNullable<typeof w.r> } => w.r !== null);
  if (windows.length === 0) return help("I couldn't read the shift times for that.");

  const from = new Date(Math.min(...windows.map((w) => w.r.start.getTime())));
  const to = new Date(Math.max(...windows.map((w) => w.r.end.getTime())));
  const assignCtx = await loadAssignmentContext(principal.companyId, from, to);

  const label = formatSingleDayLabel(date.y, date.m, date.d, timezone);
  const parts = windows.map(({ name, r }) => {
    const free = team
      .filter((m) => m.role !== "owner")
      .filter(
        (m) =>
          evaluateEligibility(assignCtx, {
            employeeId: m.id,
            designation: m.designation,
            filterDesignation: null,
            start: r.start,
            end: r.end,
            timezone,
          }).eligible,
      );
    const times = name === "morning"
      ? `${fmt12(presets.morning_start)}–${fmt12(presets.morning_end)}`
      : `${fmt12(presets.evening_start)}–${fmt12(presets.evening_end)}`;
    return `${name} (${times}): ${free.length ? joinNames(free.map((m) => m.fullName)) : "no one"}`;
  });
  return queryResult({
    answer: `Free to work on ${label}: ${parts.join("; ")}.`,
    window_label: label,
  });
}
