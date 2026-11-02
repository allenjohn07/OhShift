import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "../../../db";
import { shifts } from "../../../db/schema";
import {
  answerFromCuratedFacts,
  curateShiftFact,
  dayRangeFromYmd,
  endOfLocalDay,
  formatSingleDayLabel,
  formatWindowLabel,
  localParts,
  matchesPartOfDay,
  resolvePartOfDay,
  resolveQueryRange,
  startOfLocalDay,
} from "../../nl-schedule-ask";
import {
  extractDateFromPrompt,
  extractWeekdayFromPrompt,
  parseShiftFromPrompt,
} from "../../nl-shift-parse";
import { serializeShift } from "../../serialize";
import { findPeople, joinNames } from "../slots";
import {
  help,
  isManagerPrincipal,
  queryResult,
  type AskQuery,
  type AskResult,
  type ExecContext,
  type TeamMember,
} from "../types";

export type Window = { start: Date; end: Date; label: string };

const DATE_CUE =
  /\b(today|tonight|tomorrow|yesterday|this week|next week|last week|this weekend)\b/i;

export const hasDateCue = (prompt: string) =>
  DATE_CUE.test(prompt) ||
  extractWeekdayFromPrompt(prompt) !== null ||
  extractDateFromPrompt(prompt, "UTC") !== null;

/** The day the question is about, else `fallback`. */
export function dayWindow(ctx: ExecContext): Window {
  if (hasDateCue(ctx.prompt)) return resolveQueryRange(ctx.prompt, {}, ctx.timezone);
  const p = localParts(ctx.now, ctx.timezone);
  const r = dayRangeFromYmd(p.y, p.m, p.d, ctx.timezone);
  return { ...r, label: formatSingleDayLabel(p.y, p.m, p.d, ctx.timezone) };
}

/** The window the question is about, else the next two weeks. */
export function upcomingWindow(ctx: ExecContext): Window {
  if (hasDateCue(ctx.prompt)) return resolveQueryRange(ctx.prompt, {}, ctx.timezone);
  const start = startOfLocalDay(ctx.timezone, 0);
  const end = endOfLocalDay(ctx.timezone, 13);
  return { start, end, label: formatWindowLabel(start, end, ctx.timezone, "Next 14 days") };
}

const SELF_RE = /\b(my|me|mine|myself|i)\b/i;
export const refersToSelf = (prompt: string) => SELF_RE.test(prompt);

type Row = Awaited<ReturnType<typeof fetchShifts>>[number];

/** Shifts overlapping the window. Employees only ever get published ones. */
async function fetchShifts(
  ctx: ExecContext,
  range: Window,
  employeeIds: string[] | null,
) {
  const { principal } = ctx;
  return db.query.shifts.findMany({
    where: and(
      eq(shifts.companyId, principal.companyId),
      employeeIds ? inArray(shifts.employeeId, employeeIds) : undefined,
      isManagerPrincipal(principal) ? undefined : eq(shifts.status, "published"),
      lt(shifts.startTime, range.end),
      gt(shifts.endTime, range.start),
    ),
    with: { employee: { columns: { fullName: true } } },
    orderBy: asc(shifts.startTime),
    limit: 100,
  });
}

function toResult(
  ctx: ExecContext,
  rows: Row[],
  range: Window,
  employeeName: string | null,
  teamWide: boolean,
): AskQuery {
  const partOfDay = resolvePartOfDay(ctx.prompt);
  const kept = rows.filter((s) =>
    matchesPartOfDay(s.startTime, ctx.timezone, partOfDay, ctx.presets),
  );
  const facts = kept.map((s) =>
    curateShiftFact(
      {
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        employee: s.employee,
      },
      ctx.timezone,
    ),
  );

  let answer = answerFromCuratedFacts({
    windowLabel: range.label,
    employeeName,
    partOfDay,
    facts,
    teamWide,
  });
  const drafts = kept.filter((s) => s.status === "draft").length;
  if (drafts > 0 && isManagerPrincipal(ctx.principal)) {
    answer += ` ${drafts} of these ${drafts === 1 ? "is a draft" : "are drafts"} not yet published.`;
  }

  return queryResult({
    answer,
    window_label: range.label,
    person: employeeName,
    topic: "schedule",
    shifts: kept.map((s) => serializeShift({ ...s, users: { fullName: s.employee.fullName } })),
  });
}

/** "Who is working Friday?" */
export async function runWhoWorking(ctx: ExecContext): Promise<AskResult> {
  const range = dayWindow(ctx);
  const rows = await fetchShifts(ctx, range, null);
  return toResult(ctx, rows, range, null, true);
}

async function personShifts(ctx: ExecContext, person: TeamMember): Promise<AskResult> {
  const range = upcomingWindow(ctx);
  const rows = await fetchShifts(ctx, range, [person.id]);
  return toResult(ctx, rows, range, person.fullName, false);
}

/** "When is Sam working?" */
export async function runPersonShifts(ctx: ExecContext): Promise<AskResult> {
  const { people, ambiguous } = findPeople(ctx.prompt, ctx.team);
  if (ambiguous.length > 0) {
    return help(
      `Which one do you mean: ${joinNames(ambiguous.map((a) => a.fullName))}?`,
      ambiguous.map((a) => `When is ${a.fullName} working?`),
    );
  }
  if (people.length === 0) {
    if (refersToSelf(ctx.prompt)) return runMyShifts(ctx);
    return help("I couldn't find that person on your team.", [
      "Who is working today?",
      "Who is on the team?",
    ]);
  }
  return personShifts(ctx, people[0]!);
}

/** "When do I work next?" / "What are my shifts this week?" */
export async function runMyShifts(ctx: ExecContext): Promise<AskResult> {
  const me = ctx.team.find((m) => m.id === ctx.principal.userId);
  const name = me?.fullName ?? ctx.principal.fullName;
  const range = upcomingWindow(ctx);
  const rows = await fetchShifts(ctx, range, [ctx.principal.userId]);

  const asksNext = /\bnext\b/i.test(ctx.prompt) && !hasDateCue(ctx.prompt);
  if (asksNext) {
    const upcoming = rows.filter((s) => s.endTime > ctx.now);
    const first = upcoming[0];
    if (!first) {
      return queryResult({
        answer: "You have no upcoming shifts in the next two weeks.",
        window_label: range.label,
        person: name,
        topic: "schedule",
      });
    }
    return toResult(ctx, [first], range, name, false);
  }

  const result = toResult(ctx, rows, range, name, false);
  if (rows.length === 0) {
    result.answer = `You have no shifts for ${range.label}.`;
  }
  return result;
}

/** "Who is off tomorrow?" (people with no shift in the window) */
export async function runWhoIsOff(ctx: ExecContext): Promise<AskResult> {
  const range = dayWindow(ctx);
  const rows = await fetchShifts(ctx, range, null);
  const working = new Set(rows.map((r) => r.employeeId));
  const off = ctx.team.filter((m) => m.role !== "owner" && !working.has(m.id));
  const answer =
    off.length === 0
      ? `Everyone on the team has a shift for ${range.label}.`
      : `No shift for ${range.label}: ${joinNames(off.map((m) => m.fullName))}.`;
  return queryResult({ answer, window_label: range.label });
}

/** "Put Sam on Friday morning": a proposal the manager confirms in the UI. */
export async function runCreate(ctx: ExecContext): Promise<AskResult> {
  const roster = ctx.team
    .filter((m) => m.role !== "owner" || m.id === ctx.principal.userId)
    .map((m) => ({ id: m.id, full_name: m.fullName, designation: m.designation }));
  const self = roster.find((m) => m.id === ctx.principal.userId) ?? {
    id: ctx.principal.userId,
    full_name: ctx.principal.fullName,
    designation: null,
  };
  const result = await parseShiftFromPrompt({
    prompt: ctx.prompt,
    timezone: ctx.timezone,
    roster,
    presets: ctx.presets,
    self,
  });
  return "employee_id" in result ? { kind: "create", proposal: result } : result;
}
