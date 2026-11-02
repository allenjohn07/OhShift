import {
  extractDateFromPrompt,
  extractWeekdayFromPrompt,
  type ShiftPresets,
  zonedLocalToDate,
} from "./nl-shift-parse";

/**
 * Date-window and wording helpers for schedule questions, shared by the
 * executors in `./ai/executors`. (Question routing and answering live in
 * `./ai`; this file no longer decides what a question means.)
 */
type QueryFilterModel = {
  intent?: string | null;
  employee_id?: string | null;
  range_start?: string | null;
  range_end?: string | null;
  part_of_day?: "morning" | "evening" | "any" | null;
  error?: string | null;
};

export function localParts(
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

export function startOfLocalDay(timeZone: string, offsetDays = 0): Date {
  const p = localParts(new Date(), timeZone);
  return zonedLocalToDate(p.y, p.m, p.d + offsetDays, 0, 0, timeZone);
}

export function endOfLocalDay(timeZone: string, offsetDays = 0): Date {
  const p = localParts(new Date(), timeZone);
  return zonedLocalToDate(p.y, p.m, p.d + offsetDays + 1, 0, 0, timeZone);
}

export function dayRangeFromYmd(
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
export function thisWeekRange(timeZone: string): { start: Date; end: Date } {
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

export function looksLikeQuery(prompt: string): boolean {
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

/**
 * Resolve the lookup window from the prompt first; only fall back to the
 * model when the prompt has no usable date signal.
 */
export function resolveQueryRange(
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

export function formatSingleDayLabel(
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

export function formatWindowLabel(
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

/** Only filter morning/evening when the user said so — never invent it. */
export function resolvePartOfDay(prompt: string): "morning" | "evening" | "any" {
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

export function matchesPartOfDay(
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

export type CuratedShiftFact = {
  employee: string;
  weekday: string;
  date: string;
  start: string;
  end: string;
  title: string;
  status: string;
};

export function curateShiftFact(
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
export function answerFromCuratedFacts(options: {
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

/** YYYY-MM-DD in the manager's timezone — same bucketing idea as Team Schedule. */
export function localYmd(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

