import { runChatCompletion } from "./workers-ai";
import { prisma } from "./prisma";
import { serializeShift } from "./serialize";
import {
  extractDateFromPrompt,
  extractWeekdayFromPrompt,
  parseShiftFromPrompt,
  type ParsedShiftProposal,
  type ParseShiftFailure,
  type RosterMember,
  type ShiftPresets,
  zonedLocalToDate,
} from "./nl-shift-parse";

export type ScheduleAskCreate = {
  kind: "create";
  proposal: ParsedShiftProposal;
};

export type ScheduleAskQuery = {
  kind: "query";
  answer: string;
  /** Human label for the resolved day/week window */
  window_label: string;
  person: string | null;
  shifts: ReturnType<typeof serializeShift>[];
};

export type ScheduleAskResult =
  | ScheduleAskCreate
  | ScheduleAskQuery
  | ParseShiftFailure;

type QueryFilterModel = {
  intent?: string | null;
  employee_id?: string | null;
  range_start?: string | null;
  range_end?: string | null;
  part_of_day?: "morning" | "evening" | "any" | null;
  error?: string | null;
};

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function localParts(
  date: Date,
  timeZone: string,
): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: map[get("weekday")] ?? 0,
  };
}

function startOfLocalDay(timeZone: string, offsetDays = 0): Date {
  const p = localParts(new Date(), timeZone);
  return zonedLocalToDate(p.y, p.m, p.d + offsetDays, 0, 0, timeZone);
}

function endOfLocalDay(timeZone: string, offsetDays = 0): Date {
  const p = localParts(new Date(), timeZone);
  return zonedLocalToDate(p.y, p.m, p.d + offsetDays + 1, 0, 0, timeZone);
}

function dayRangeFromYmd(
  y: number,
  m: number,
  d: number,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedLocalToDate(y, m, d, 0, 0, timeZone),
    end: zonedLocalToDate(y, m, d + 1, 0, 0, timeZone),
  };
}

/** Monday 00:00 → next Monday 00:00 in local timezone (no DST ms math). */
function thisWeekRange(timeZone: string): { start: Date; end: Date } {
  const today = localParts(new Date(), timeZone);
  const daysFromMonday = (today.weekday + 6) % 7;
  const thisMondayOffset = -daysFromMonday;
  return {
    start: zonedLocalToDate(
      today.y,
      today.m,
      today.d + thisMondayOffset,
      0,
      0,
      timeZone,
    ),
    end: zonedLocalToDate(
      today.y,
      today.m,
      today.d + thisMondayOffset + 7,
      0,
      0,
      timeZone,
    ),
  };
}

/** Monday-start week containing today, then +7 for next week. */
function nextWeekRange(timeZone: string): { start: Date; end: Date } {
  const thisWeek = thisWeekRange(timeZone);
  const startParts = localParts(thisWeek.start, timeZone);
  return {
    start: zonedLocalToDate(
      startParts.y,
      startParts.m,
      startParts.d + 7,
      0,
      0,
      timeZone,
    ),
    end: zonedLocalToDate(
      startParts.y,
      startParts.m,
      startParts.d + 14,
      0,
      0,
      timeZone,
    ),
  };
}

/** Previous calendar date matching weekday (strictly before today). */
function previousLocalDateForWeekday(
  weekday: number,
  timeZone: string,
): { y: number; m: number; d: number } {
  const now = localParts(new Date(), timeZone);
  let delta = (now.weekday - weekday + 7) % 7;
  if (delta === 0) delta = 7;
  const target = zonedLocalToDate(
    now.y,
    now.m,
    now.d - delta,
    12,
    0,
    timeZone,
  );
  const p = localParts(target, timeZone);
  return { y: p.y, m: p.m, d: p.d };
}

function promptSuggestsPast(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  // Only clear past cues — bare "was" is too common for scheduled shifts
  // ("was Albin working Wednesday?" often means the upcoming Wednesday).
  return (
    /\byesterday\b/.test(lower) ||
    /\blast\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    ) ||
    /\blast\s+week\b/.test(lower)
  );
}

function upcomingDaysHint(timeZone: string): string {
  const now = localParts(new Date(), timeZone);
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const lines: string[] = [];
  for (let i = -7; i <= 14; i++) {
    const localNoon = zonedLocalToDate(now.y, now.m, now.d + i, 12, 0, timeZone);
    const p = localParts(localNoon, timeZone);
    const label =
      i === 0
        ? "today"
        : i === 1
          ? "tomorrow"
          : i === -1
            ? "yesterday"
            : names[p.weekday];
    lines.push(
      `- ${names[p.weekday]} ${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")} (${label})`,
    );
  }
  return lines.join("\n");
}

function looksLikeQuery(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  if (p.includes("?")) return true;
  // Explicit lookups / list requests
  if (
    /\b(give me|show me|list|get|pull up|look up|check|find|retrieve|fetch)\b/.test(
      p,
    )
  ) {
    return true;
  }
  if (
    /\b(shifts?|schedule)\s+of\b/.test(p) ||
    /\b(whose|who'?s)\s+(working|on|scheduled)\b/.test(p) ||
    /\bwhat\s+shifts?\b/.test(p) ||
    /\bon the schedule\b/.test(p)
  ) {
    return true;
  }
  return /\b(is|are|who|when|does|did|will|was|were|working|scheduled|where)\b/.test(
    p,
  );
}

function looksLikeCreate(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  // Don't treat "give me the schedule/shifts" as create
  if (looksLikeQuery(prompt) && /\b(shifts?|working|who)\b/.test(p)) {
    return false;
  }
  return /\b(add|assign|create|put|book)\b/.test(p) ||
    /\bschedule\s+(me|myself|[a-z][a-z'-]+)\b/.test(p);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a roster member from the prompt. Prefer full name, then first/last
 * token with word boundaries (avoids partial false positives).
 * Skips team-wide questions ("who is working…") so we don't latch onto a name.
 */
export function matchEmployeeFromPrompt(
  prompt: string,
  roster: RosterMember[],
): RosterMember | null {
  if (isTeamWideQuery(prompt)) return null;

  const lower = prompt.toLowerCase();
  // Ignore common question words that can false-match short names
  const scored = roster
    .map((m) => {
      const name = m.full_name.toLowerCase().trim();
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0] ?? "";
      const last = parts.length > 1 ? parts[parts.length - 1] : "";
      let score = 0;
      if (name.length >= 2 && lower.includes(name)) score = 4;
      else {
        if (first.length >= 2) {
          const re = new RegExp(`\\b${escapeRegExp(first)}\\b`, "i");
          if (re.test(lower)) score = Math.max(score, first.length >= 4 ? 3 : 2);
        }
        if (last.length >= 3) {
          const re = new RegExp(`\\b${escapeRegExp(last)}\\b`, "i");
          if (re.test(lower)) score = Math.max(score, 2);
        }
      }
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.m.full_name.length - a.m.full_name.length,
    );
  return scored[0]?.m ?? null;
}

/**
 * "Who is the manager?" / "Who is the owner?" — org role lookup, not schedule.
 */
export function isOrgRoleQuery(
  prompt: string,
): "managers" | "owner" | "both" | null {
  const p = prompt.trim().toLowerCase();

  const asksManagers =
    /\bwho(?:'s|\s+is|\s+are)?\s+(?:the\s+|our\s+|my\s+|a\s+)?managers?\b/.test(
      p,
    ) ||
    /\b(?:list|show|give me|tell me)\s+(?:the\s+|our\s+|my\s+)?managers?\b/.test(
      p,
    ) ||
    /\bwho\s+manages\b/.test(p);

  const asksOwner =
    /\bwho(?:'s|\s+is|\s+are)?\s+(?:the\s+|our\s+|my\s+|a\s+)?owners?\b/.test(
      p,
    ) ||
    /\b(?:list|show|give me|tell me)\s+(?:the\s+|our\s+|my\s+)?owners?\b/.test(
      p,
    ) ||
    /\bwho\s+owns\b/.test(p);

  // "who is the manager and owner" / "who is the owner and manager"
  const bothViaAnd =
    (asksManagers && /\band\s+(?:the\s+)?owners?\b/.test(p)) ||
    (asksOwner && /\band\s+(?:the\s+)?managers?\b/.test(p));

  if (bothViaAnd || (asksManagers && asksOwner)) return "both";
  if (asksOwner) return "owner";
  if (asksManagers) return "managers";
  return null;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

async function runOrgRoleQuery(options: {
  companyId: string;
  focus: "managers" | "owner" | "both";
}): Promise<ScheduleAskQuery> {
  const members = await prisma.user.findMany({
    where: {
      companyId: options.companyId,
      role: { in: ["owner", "manager"] },
    },
    select: { fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });

  const owners = members
    .filter((m) => m.role === "owner")
    .map((m) => m.fullName);
  const managers = members
    .filter((m) => m.role === "manager")
    .map((m) => m.fullName);

  const parts: string[] = [];

  if (options.focus === "owner" || options.focus === "both") {
    if (owners.length === 0) {
      parts.push("No owner is set for this company.");
    } else if (owners.length === 1) {
      parts.push(`The owner is ${owners[0]}.`);
    } else {
      parts.push(`The owners are ${joinNames(owners)}.`);
    }
  }

  if (options.focus === "managers" || options.focus === "both") {
    if (managers.length === 0) {
      if (options.focus === "both") {
        parts.push("There are no managers assigned.");
      } else if (owners.length === 1) {
        parts.push(
          `There are no managers assigned; ${owners[0]} (owner) manages the team.`,
        );
      } else if (owners.length > 1) {
        parts.push(
          `There are no managers assigned; the owners (${joinNames(owners)}) manage the team.`,
        );
      } else {
        parts.push("There are no managers assigned.");
      }
    } else if (managers.length === 1) {
      parts.push(`The manager is ${managers[0]}.`);
      if (options.focus === "managers" && owners.length === 1) {
        parts.push(`The owner is ${owners[0]}.`);
      } else if (options.focus === "managers" && owners.length > 1) {
        parts.push(`The owners are ${joinNames(owners)}.`);
      }
    } else {
      parts.push(`The managers are ${joinNames(managers)}.`);
      if (options.focus === "managers" && owners.length === 1) {
        parts.push(`The owner is ${owners[0]}.`);
      } else if (options.focus === "managers" && owners.length > 1) {
        parts.push(`The owners are ${joinNames(owners)}.`);
      }
    }
  }

  return {
    kind: "query",
    answer: parts.join(" ").trim(),
    window_label: "Team roles",
    person: null,
    shifts: [],
  };
}

/** "Who is working Tuesday?" → whole team, not one guessed person. */
function isTeamWideQuery(prompt: string): boolean {
  if (isOrgRoleQuery(prompt)) return false;
  const p = prompt.trim().toLowerCase();
  return (
    /\bwho\b/.test(p) ||
    /\bwho'?s\b/.test(p) ||
    /\bwho\s+all\b/.test(p) ||
    /\banyone\b/.test(p) ||
    /\banybody\b/.test(p) ||
    /\beveryone\b/.test(p) ||
    /\beverybody\b/.test(p) ||
    /\bthe\s+team\b/.test(p) ||
    /\bwhich\s+(staff|people|employees|workers)\b/.test(p)
  );
}

/**
 * Resolve the lookup window from the prompt first; only fall back to the
 * model when the prompt has no usable date signal.
 */
function resolveQueryRange(
  prompt: string,
  model: QueryFilterModel,
  timeZone: string,
): { start: Date; end: Date; label: string } {
  const lower = prompt.toLowerCase();
  const weekday = extractWeekdayFromPrompt(prompt);

  // "Tuesday this week" / "this week Tuesday" → that day inside the current week
  if (weekday !== null && /\bthis week\b/.test(lower)) {
    const week = thisWeekRange(timeZone);
    const weekStart = localParts(week.start, timeZone);
    // Monday-based week: find offset of target weekday from Monday
    const mondayBased = (weekday + 6) % 7; // Sun=6, Mon=0, … Sat=5
    const target = zonedLocalToDate(
      weekStart.y,
      weekStart.m,
      weekStart.d + mondayBased,
      12,
      0,
      timeZone,
    );
    const p = localParts(target, timeZone);
    const r = dayRangeFromYmd(p.y, p.m, p.d, timeZone);
    return {
      start: r.start,
      end: r.end,
      label: formatSingleDayLabel(p.y, p.m, p.d, timeZone),
    };
  }

  // "Tuesday next week"
  if (weekday !== null && /\bnext week\b/.test(lower)) {
    const week = nextWeekRange(timeZone);
    const weekStart = localParts(week.start, timeZone);
    const mondayBased = (weekday + 6) % 7;
    const target = zonedLocalToDate(
      weekStart.y,
      weekStart.m,
      weekStart.d + mondayBased,
      12,
      0,
      timeZone,
    );
    const p = localParts(target, timeZone);
    const r = dayRangeFromYmd(p.y, p.m, p.d, timeZone);
    return {
      start: r.start,
      end: r.end,
      label: formatSingleDayLabel(p.y, p.m, p.d, timeZone),
    };
  }

  if (/\bnext week\b/.test(lower) && weekday === null) {
    const w = nextWeekRange(timeZone);
    return {
      start: w.start,
      end: w.end,
      label: formatWindowLabel(w.start, w.end, timeZone, "Next week"),
    };
  }
  if (/\bthis week\b/.test(lower) && weekday === null) {
    const w = thisWeekRange(timeZone);
    return {
      start: w.start,
      end: w.end,
      label: formatWindowLabel(w.start, w.end, timeZone, "This week"),
    };
  }
  if (/\blast week\b/.test(lower) && weekday === null) {
    const w = thisWeekRange(timeZone);
    const startParts = localParts(w.start, timeZone);
    const start = zonedLocalToDate(
      startParts.y,
      startParts.m,
      startParts.d - 7,
      0,
      0,
      timeZone,
    );
    return {
      start,
      end: w.start,
      label: formatWindowLabel(start, w.start, timeZone, "Last week"),
    };
  }

  if (
    weekday !== null &&
    promptSuggestsPast(prompt) &&
    !/\bnext\b/.test(lower)
  ) {
    const past = previousLocalDateForWeekday(weekday, timeZone);
    const r = dayRangeFromYmd(past.y, past.m, past.d, timeZone);
    return {
      start: r.start,
      end: r.end,
      label: formatSingleDayLabel(past.y, past.m, past.d, timeZone),
    };
  }

  const fromPrompt = extractDateFromPrompt(prompt, timeZone);
  if (fromPrompt) {
    const r = dayRangeFromYmd(fromPrompt.y, fromPrompt.m, fromPrompt.d, timeZone);
    return {
      start: r.start,
      end: r.end,
      label: formatSingleDayLabel(
        fromPrompt.y,
        fromPrompt.m,
        fromPrompt.d,
        timeZone,
      ),
    };
  }

  if (model.range_start && model.range_end) {
    const s = new Date(model.range_start);
    const e = new Date(model.range_end);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s < e) {
      return {
        start: s,
        end: e,
        label: formatWindowLabel(s, e, timeZone, "Selected range"),
      };
    }
  }

  const start = startOfLocalDay(timeZone, -7);
  const end = endOfLocalDay(timeZone, 14);
  return {
    start,
    end,
    label: formatWindowLabel(start, end, timeZone, "Recent & upcoming"),
  };
}

function formatSingleDayLabel(
  y: number,
  m: number,
  d: number,
  timeZone: string,
): string {
  const noon = zonedLocalToDate(y, m, d, 12, 0, timeZone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(noon);
}

function formatWindowLabel(
  start: Date,
  endExclusive: Date,
  timeZone: string,
  prefix: string,
): string {
  // end is exclusive → last included instant is end - 1ms
  const last = new Date(endExclusive.getTime() - 1);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${prefix} (${fmt.format(start)} – ${fmt.format(last)})`;
}

function resolveEmployeeId(
  prompt: string,
  roster: RosterMember[],
): string | null {
  // Only trust names that appear in the prompt — never LLM-guessed IDs
  if (isTeamWideQuery(prompt)) return null;
  return matchEmployeeFromPrompt(prompt, roster)?.id ?? null;
}

/** Only filter morning/evening when the user said so — never invent it. */
function resolvePartOfDay(prompt: string): "morning" | "evening" | "any" {
  const lower = prompt.toLowerCase();
  if (/\bevening\b/.test(lower) || /\bnight\b/.test(lower)) return "evening";
  if (/\bmorning\b/.test(lower)) return "morning";
  return "any";
}

function shiftLocalHour(start: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(start);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(h === "24" ? "0" : h);
}

function parsePresetHour(value: string, fallback: number): number {
  const m = /^([01]\d|2[0-3]):/.exec(value.trim());
  return m ? Number(m[1]) : fallback;
}

function matchesPartOfDay(
  start: Date,
  timeZone: string,
  part: "morning" | "evening" | "any",
  presets: ShiftPresets,
): boolean {
  if (part === "any") return true;
  const hour = shiftLocalHour(start, timeZone);
  const morningStart = parsePresetHour(presets.morning_start, 8);
  const eveningStart = parsePresetHour(presets.evening_start, 16);
  if (part === "morning") {
    return hour < eveningStart && hour >= Math.max(0, morningStart - 1);
  }
  return hour >= eveningStart;
}

type CuratedShiftFact = {
  employee: string;
  weekday: string;
  date: string;
  start: string;
  end: string;
  title: string;
  status: string;
};

function curateShiftFact(
  shift: {
    title: string;
    startTime: Date;
    endTime: Date;
    status: string;
    employee: { fullName: string };
  },
  timeZone: string,
): CuratedShiftFact {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(shift.startTime);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shift.startTime);
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    employee: shift.employee.fullName,
    weekday,
    date,
    start: timeFmt.format(shift.startTime),
    end: timeFmt.format(shift.endTime),
    title: shift.title,
    status: shift.status,
  };
}

/** Deterministic answer built only from DB-curated facts (source of truth). */
function answerFromCuratedFacts(options: {
  windowLabel: string;
  employeeName: string | null;
  partOfDay: "morning" | "evening" | "any";
  facts: CuratedShiftFact[];
  teamWide: boolean;
}): string {
  const { windowLabel, employeeName, partOfDay, facts, teamWide } = options;
  const part =
    partOfDay === "any" ? "" : ` (${partOfDay} shifts only)`;

  if (facts.length === 0) {
    if (employeeName) {
      return `${employeeName} has no shifts on the schedule for ${windowLabel}${part}.`;
    }
    return `No one is scheduled for ${windowLabel}${part}.`;
  }

  if (teamWide || !employeeName) {
    const byPerson = new Map<string, CuratedShiftFact[]>();
    for (const f of facts) {
      const list = byPerson.get(f.employee) ?? [];
      list.push(f);
      byPerson.set(f.employee, list);
    }
    const names = [...byPerson.keys()];
    const summaries = names.map((name) => {
      const personShifts = byPerson.get(name)!;
      const bits = personShifts.map(
        (f) => `${f.title} ${f.start}–${f.end}`,
      );
      return `${name} (${bits.join("; ")})`;
    });
    if (names.length === 1) {
      return `On ${windowLabel}, ${summaries[0]} is working.`;
    }
    return `On ${windowLabel}, ${names.length} people are working: ${summaries.join("; ")}.`;
  }

  const who = employeeName;
  const lines = facts.map(
    (f) =>
      `${f.weekday} ${f.date}: ${f.title} ${f.start}–${f.end} (${f.status})`,
  );

  if (facts.length === 1) {
    const f = facts[0]!;
    return `${who} is scheduled ${f.weekday} (${f.date}) for ${f.title}, ${f.start}–${f.end} (${f.status}). Looking at ${windowLabel}.`;
  }

  return `${who} has ${facts.length} shifts for ${windowLabel}${part}: ${lines.join("; ")}.`;
}

/**
 * Optional polish — AI may only rephrase curated facts. On any failure we
 * keep the deterministic answer so the UI never invents schedule data.
 */
async function polishAnswerWithAi(options: {
  prompt: string;
  timeZone: string;
  windowLabel: string;
  curatedAnswer: string;
  facts: CuratedShiftFact[];
}): Promise<string> {
  const { prompt, timeZone, windowLabel, curatedAnswer, facts } = options;
  if (facts.length === 0) return curatedAnswer;

  try {
    const text = await runChatCompletion([
      {
        role: "system",
        content: `You rephrase schedule facts for a manager. Rules:
- Use ONLY the curated_shifts JSON and curated_answer below.
- Do not add, remove, or change any person, day, date, or time.
- If multiple people are in curated_shifts, you MUST name each of them.
- 1–3 short sentences. No markdown. No invented shifts.
- Timezone context: ${timeZone}. Window: ${windowLabel}.`,
      },
      {
        role: "user",
        content: `Question: ${prompt}

Window: ${windowLabel}

curated_shifts:
${JSON.stringify(facts, null, 2)}

curated_answer (must stay factually identical):
${curatedAnswer}

Rewrite curated_answer in natural conversational English without changing facts.`,
      },
    ]);
    const polished = text.trim();
    if (!polished) return curatedAnswer;
    return polished;
  } catch {
    return curatedAnswer;
  }
}

/** YYYY-MM-DD in the manager's timezone — same bucketing idea as Team Schedule. */
function localYmd(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdsInRange(
  rangeStart: Date,
  rangeEndExclusive: Date,
  timeZone: string,
): Set<string> {
  const days = new Set<string>();
  let cursor = localParts(rangeStart, timeZone);
  const last = localParts(new Date(rangeEndExclusive.getTime() - 1), timeZone);
  const lastKey = last.y * 10_000 + last.m * 100 + last.d;
  for (let i = 0; i < 40; i++) {
    const key = cursor.y * 10_000 + cursor.m * 100 + cursor.d;
    days.add(
      `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(cursor.d).padStart(2, "0")}`,
    );
    if (key >= lastKey) break;
    const next = zonedLocalToDate(cursor.y, cursor.m, cursor.d + 1, 12, 0, timeZone);
    cursor = localParts(next, timeZone);
  }
  return days;
}

async function runQuery(options: {
  prompt: string;
  companyId: string;
  timezone: string;
  roster: RosterMember[];
  presets: ShiftPresets;
}): Promise<ScheduleAskQuery | ParseShiftFailure> {
  const { prompt, companyId, timezone, roster, presets } = options;

  const teamWide = isTeamWideQuery(prompt);
  // Team-wide "who" questions must never filter to one person (LLM used to guess Albin).
  const resolvedEmployeeId = teamWide
    ? null
    : resolveEmployeeId(prompt, roster);

  const promptHasDateCue =
    Boolean(extractWeekdayFromPrompt(prompt)) ||
    /\b(today|tonight|tomorrow|this week|next week|last week|yesterday)\b/i.test(
      prompt,
    );

  let model: QueryFilterModel = {};
  if (!promptHasDateCue) {
    try {
      const text = await runChatCompletion([
        {
          role: "system",
          content: `Extract a date range for a schedule lookup. Return ONLY JSON:
{"range_start":"<ISO or null>","range_end":"<ISO exclusive or null>","part_of_day":"any","error":null}

Do NOT pick an employee. Calendar:
${upcomingDaysHint(timezone)}
Timezone: ${timezone}`,
        },
        { role: "user", content: prompt },
      ]);
      model = JSON.parse(stripJsonFences(text)) as QueryFilterModel;
    } catch {
      model = {};
    }
  }

  const range = promptHasDateCue
    ? resolveQueryRange(prompt, {}, timezone)
    : resolveQueryRange(prompt, model, timezone);
  const partOfDay = resolvePartOfDay(prompt);
  const targetDays = ymdsInRange(range.start, range.end, timezone);

  if (
    !teamWide &&
    !resolvedEmployeeId &&
    /\b(is|does|will|was|were|where|give|show|shifts?\s+of)\b/i.test(prompt) &&
    !matchEmployeeFromPrompt(prompt, roster)
  ) {
    const maybeName = prompt.match(
      /\b(?:is|does|will|was|were|where|of)\s+([A-Za-z][A-Za-z'-]+)/i,
    );
    if (
      maybeName &&
      !/^(all|anyone|anybody|everybody|everyone|the)$/i.test(maybeName[1])
    ) {
      return {
        error: `Could not find “${maybeName[1]}” on your team.`,
      };
    }
  }

  // Loose DB window (±12h) then bucket by local calendar day like Team Schedule
  const fetchStart = new Date(range.start.getTime() - 12 * 60 * 60 * 1000);
  const fetchEnd = new Date(range.end.getTime() + 12 * 60 * 60 * 1000);

  const rows = await prisma.shift.findMany({
    where: {
      companyId,
      ...(resolvedEmployeeId ? { employeeId: resolvedEmployeeId } : {}),
      startTime: { lt: fetchEnd },
      endTime: { gt: fetchStart },
    },
    include: { employee: { select: { fullName: true } } },
    orderBy: { startTime: "asc" },
    take: 100,
  });

  const filtered = rows.filter((s) => {
    if (!matchesPartOfDay(s.startTime, timezone, partOfDay, presets)) {
      return false;
    }
    // Same rule as Team Schedule grid: shift belongs to the local day it starts on
    return targetDays.has(localYmd(s.startTime, timezone));
  });

  const facts = filtered.map((s) =>
    curateShiftFact(
      {
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        employee: s.employee,
      },
      timezone,
    ),
  );

  const employeeName = resolvedEmployeeId
    ? roster.find((m) => m.id === resolvedEmployeeId)?.full_name ?? null
    : null;

  const curatedAnswer = answerFromCuratedFacts({
    windowLabel: range.label,
    employeeName,
    partOfDay,
    facts,
    teamWide: teamWide || !employeeName,
  });

  // Skip AI polish for team-wide / multi-person — it was collapsing people into one
  const answer =
    teamWide || facts.length > 1
      ? curatedAnswer
      : await polishAnswerWithAi({
          prompt,
          timeZone: timezone,
          windowLabel: range.label,
          curatedAnswer,
          facts,
        });

  return {
    kind: "query",
    answer,
    window_label: range.label,
    person: employeeName,
    shifts: filtered.map((s) =>
      serializeShift({
        ...s,
        users: { fullName: s.employee.fullName },
      }),
    ),
  };
}

export async function askSchedule(options: {
  prompt: string;
  companyId: string;
  timezone: string;
  roster: RosterMember[];
  self: RosterMember;
  presets: ShiftPresets;
}): Promise<ScheduleAskResult> {
  const { prompt, companyId, timezone, roster, self, presets } = options;

  const roleFocus = isOrgRoleQuery(prompt);
  if (roleFocus) {
    return runOrgRoleQuery({ companyId, focus: roleFocus });
  }

  const preferQuery = looksLikeQuery(prompt) && !looksLikeCreate(prompt);
  const preferCreate = looksLikeCreate(prompt) && !looksLikeQuery(prompt);

  if (preferQuery || (looksLikeQuery(prompt) && !preferCreate)) {
    return runQuery({ prompt, companyId, timezone, roster, presets });
  }

  const created = await parseShiftFromPrompt({
    prompt,
    timezone,
    roster,
    presets,
    self,
  });

  if ("employee_id" in created) {
    return { kind: "create", proposal: created };
  }

  if (looksLikeQuery(prompt)) {
    return runQuery({ prompt, companyId, timezone, roster, presets });
  }

  return created;
}
