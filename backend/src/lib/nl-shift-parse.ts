import { runChatCompletion } from "./workers-ai";

export type RosterMember = {
  id: string;
  full_name: string;
  designation: string | null;
};

export type ParsedShiftProposal = {
  employee_id: string;
  employee_name: string;
  title: string;
  start_time: string;
  end_time: string;
  interpretation: string;
};

export type ParseShiftFailure = {
  error: string;
};

export type ShiftPresets = {
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
};

export type ModelOutput = {
  employee_id?: string | null;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  interpretation?: string | null;
  error?: string | null;
};

function parseHhMm(
  value: string | null | undefined,
): { hour: number; min: number } | null {
  if (!value || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim())) return null;
  const [hour, min] = value.trim().split(":").map(Number);
  return { hour, min };
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_ALIASES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function weekdayName(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone,
  }).format(date);
}

function localParts(
  date: Date,
  timeZone: string,
): { y: number; m: number; d: number; h: number; min: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekdayShort = get("weekday");
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
    h: Number(get("hour") === "24" ? "0" : get("hour")),
    min: Number(get("minute")),
    weekday: map[weekdayShort] ?? 0,
  };
}

function formatNow(timeZone: string): string {
  const now = new Date();
  const p = localParts(now, timeZone);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")} ${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")} (${weekdayName(now, timeZone)})`;
}

/** Next 14 calendar days so the model can map “Wednesday” to a concrete date. */
function upcomingDaysHint(timeZone: string): string {
  const now = localParts(new Date(), timeZone);
  const lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    const localNoon = zonedLocalToDate(now.y, now.m, now.d + i, 12, 0, timeZone);
    const p = localParts(localNoon, timeZone);
    const label =
      i === 0 ? "today" : i === 1 ? "tomorrow" : WEEKDAY_NAMES[p.weekday];
    lines.push(
      `- ${WEEKDAY_NAMES[p.weekday]} ${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")} (${label})`,
    );
  }
  return lines.join("\n");
}

/**
 * Convert a wall-clock datetime in `timeZone` to a UTC Date.
 * `day` may overflow (e.g. month 1 day 40) — normalized via Date.UTC.
 */
export function zonedLocalToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();

  let guess = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    const parts = localParts(new Date(guess), timeZone);
    const asLocalUtc = Date.UTC(
      parts.y,
      parts.m - 1,
      parts.d,
      parts.h,
      parts.min,
      0,
    );
    const want = Date.UTC(y, m - 1, d, hour, minute, 0);
    const diff = want - asLocalUtc;
    guess += diff;
    if (diff === 0) break;
  }
  return new Date(guess);
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function buildSystemPrompt(
  roster: RosterMember[],
  timeZone: string,
  presets: ShiftPresets,
  self: RosterMember | null,
): string {
  const rosterJson = JSON.stringify(
    roster.map((m) => ({
      id: m.id,
      full_name: m.full_name,
      designation: m.designation,
    })),
  );

  const selfLine = self
    ? `Current manager (for "me" / "myself"): id=${self.id}, name=${self.full_name}`
    : `Current manager is not on the assignable roster.`;

  return `You are OhShift's schedule assistant. Extract ONE shift assignment from the manager's message.

Rules:
- Use only employee ids from the roster. Match names case-insensitively (first name, full name, nicknames).
- "${self?.full_name ?? "the current user"}": phrases like "me", "myself", "add me", "schedule me", "put me on" MUST use that person's id (${self?.id ?? "n/a"}).
- Weekdays: use the Upcoming calendar. "Tuesday" / "this Tuesday" = the next listed Tuesday (may be today). "next Tuesday" = the Tuesday after today (never today). "next week Tuesday" / "Tuesday next week" = Tuesday of the following calendar week.
- "today", "tomorrow", "tonight" (tonight = today + evening preset).
- Company presets when they say morning/evening without clock times:
  - morning = ${presets.morning_start}–${presets.morning_end} local
  - evening = ${presets.evening_start}–${presets.evening_end} local
- Clock ranges ("4 to 11", "9am-5pm"): honor am/pm; with "evening" bare hours 1–11 are PM.
- Default title: designation, else "Morning Shift" / "Evening Shift" / "Shift".
- Output ONLY JSON (no markdown):
{"employee_id":string|null,"title":string|null,"start_time":string|null,"end_time":string|null,"interpretation":string,"error":string|null}
- Timestamps ISO-8601 with offset for ${timeZone}.
- Examples of valid intents: "add me to next tuesday evening", "schedule myself friday morning", "put Maya on tomorrow evening", "Bob Thursday 9-5", "this Friday evening for Sam".

${selfLine}
Now: ${formatNow(timeZone)}
Upcoming calendar (${timeZone}):
${upcomingDaysHint(timeZone)}
Roster: ${rosterJson}`;
}

/** Pull a weekday mentioned in the prompt (0=Sun … 6=Sat). */
export function extractWeekdayFromPrompt(prompt: string): number | null {
  const lower = prompt.toLowerCase();
  // Prefer longer names first
  const keys = Object.keys(WEEKDAY_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(lower)) return WEEKDAY_ALIASES[key]!;
  }
  return null;
}

/** True when the manager refers to themselves as the assignee. */
export function promptRefersToSelf(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    /\b(add|put|schedule|assign|give|book|set)\s+(me|myself)\b/.test(lower) ||
    /\b(me|myself)\s+(to|on|for|in|at)\b/.test(lower) ||
    /\bfor\s+me\b/.test(lower) ||
    /\bto\s+me\b/.test(lower) ||
    /\bschedule\s+myself\b/.test(lower) ||
    /\bassign\s+myself\b/.test(lower)
  );
}

export function applySelfReference(
  prompt: string,
  raw: ModelOutput,
  self: RosterMember | null,
): ModelOutput {
  if (!self || !promptRefersToSelf(prompt)) return raw;
  return {
    ...raw,
    employee_id: self.id,
    error: null,
  };
}

/**
 * Detect "4 to 11", "4-11", "4pm-11pm" style ranges.
 * Returns 24h hours; applies evening/morning context when am/pm omitted.
 */
export function extractTimeRangeFromPrompt(
  prompt: string,
): { startHour: number; startMin: number; endHour: number; endMin: number } | null {
  const lower = prompt.toLowerCase();
  const evening =
    /\b(evening|night|tonight)\b/.test(lower) ||
    /\bevening\s+shift\b/.test(lower);
  const morning = /\b(morning)\b/.test(lower) && !evening;

  const rangeRe =
    /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:to|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;
  const match = lower.match(rangeRe);
  if (!match) return null;

  let startHour = Number(match[1]);
  const startMin = Number(match[2] ?? "0");
  const startMeridiem = (match[3] ?? "").replace(/\./g, "");
  let endHour = Number(match[4]);
  const endMin = Number(match[5] ?? "0");
  const endMeridiem = (match[6] ?? "").replace(/\./g, "");

  if (startHour > 23 || endHour > 23 || startMin > 59 || endMin > 59) {
    return null;
  }

  const applyMeridiem = (
    hour: number,
    meridiem: string,
    fallbackPm: boolean,
  ): number => {
    if (hour > 12) return hour;
    if (meridiem.startsWith("p")) return hour === 12 ? 12 : hour + 12;
    if (meridiem.startsWith("a")) return hour === 12 ? 0 : hour;
    if (fallbackPm) {
      if (hour === 12) return 12;
      if (hour >= 1 && hour <= 11) return hour + 12;
    }
    return hour;
  };

  const fallbackPm = evening && !morning;
  startHour = applyMeridiem(startHour, startMeridiem, fallbackPm);
  endHour = applyMeridiem(endHour, endMeridiem, fallbackPm);

  // Bare "9-5" / "9 to 5" with no am/pm and no evening/morning → daytime (end PM).
  if (
    !startMeridiem &&
    !endMeridiem &&
    !evening &&
    !morning &&
    startHour <= 12 &&
    endHour <= 12 &&
    endHour <= startHour
  ) {
    endHour += 12;
  }

  return { startHour, startMin, endHour, endMin };
}

/** Use company morning/evening presets when the prompt names that shift and has no clock range. */
export function extractPresetRangeFromPrompt(
  prompt: string,
  presets: ShiftPresets,
): {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  label: "Morning" | "Evening";
} | null {
  if (extractTimeRangeFromPrompt(prompt)) return null;

  const lower = prompt.toLowerCase();
  const wantsEvening =
    /\bevening(\s+shift)?\b/.test(lower) ||
    /\bnight\s+shift\b/.test(lower) ||
    /\btonight\b/.test(lower);
  const wantsMorning = /\bmorning(\s+shift)?\b/.test(lower);

  if (wantsEvening && !wantsMorning) {
    const start = parseHhMm(presets.evening_start) ?? { hour: 16, min: 0 };
    const end = parseHhMm(presets.evening_end) ?? { hour: 23, min: 0 };
    return {
      startHour: start.hour,
      startMin: start.min,
      endHour: end.hour,
      endMin: end.min,
      label: "Evening",
    };
  }
  if (wantsMorning && !wantsEvening) {
    const start = parseHhMm(presets.morning_start) ?? { hour: 8, min: 0 };
    const end = parseHhMm(presets.morning_end) ?? { hour: 16, min: 0 };
    return {
      startHour: start.hour,
      startMin: start.min,
      endHour: end.hour,
      endMin: end.min,
      label: "Morning",
    };
  }
  return null;
}

type WeekdayMode = "upcoming" | "strict_next" | "next_week";

function weekdayModeFromPrompt(prompt: string): WeekdayMode {
  const lower = prompt.toLowerCase();
  if (
    /\bnext\s+week\b/.test(lower) ||
    /\bweek\s+after\b/.test(lower) ||
    /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\w*\s+next\s+week\b/.test(
      lower,
    ) ||
    /\bnext\s+week(?:'s)?\s+(?:mon|tue|wed|thu|fri|sat|sun)/.test(lower)
  ) {
    return "next_week";
  }
  // "next Tuesday" but not "next week"
  if (
    /\bnext\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lower,
    )
  ) {
    return "strict_next";
  }
  return "upcoming";
}

/** Resolve a calendar day from weekday / today / tomorrow / tonight, else null. */
export function extractDateFromPrompt(
  prompt: string,
  timeZone: string,
): { y: number; m: number; d: number } | null {
  const lower = prompt.toLowerCase();
  const now = localParts(new Date(), timeZone);

  if (/\btoday\b/.test(lower) || /\btonight\b/.test(lower)) {
    return { y: now.y, m: now.m, d: now.d };
  }
  if (/\btomorrow\b/.test(lower)) {
    const t = zonedLocalToDate(now.y, now.m, now.d + 1, 12, 0, timeZone);
    const p = localParts(t, timeZone);
    return { y: p.y, m: p.m, d: p.d };
  }

  const weekday = extractWeekdayFromPrompt(prompt);
  if (weekday !== null) {
    return nextLocalDateForWeekday(weekday, timeZone, weekdayModeFromPrompt(prompt));
  }
  return null;
}

function dateFromModelStart(
  raw: ModelOutput,
  timeZone: string,
): { y: number; m: number; d: number } | null {
  if (typeof raw.start_time !== "string" || !raw.start_time.trim()) return null;
  const start = new Date(raw.start_time);
  if (Number.isNaN(start.getTime())) return null;
  const p = localParts(start, timeZone);
  return { y: p.y, m: p.m, d: p.d };
}

function tomorrowLocal(timeZone: string): { y: number; m: number; d: number } {
  const now = localParts(new Date(), timeZone);
  const t = zonedLocalToDate(now.y, now.m, now.d + 1, 12, 0, timeZone);
  const p = localParts(t, timeZone);
  return { y: p.y, m: p.m, d: p.d };
}

/**
 * Next calendar date matching weekday.
 * - upcoming: soonest including today
 * - strict_next: soonest strictly after today ("next Tuesday")
 * - next_week: that weekday in the following calendar week
 */
export function nextLocalDateForWeekday(
  weekday: number,
  timeZone: string,
  mode: WeekdayMode = "upcoming",
): { y: number; m: number; d: number } {
  const now = localParts(new Date(), timeZone);
  let delta = (weekday - now.weekday + 7) % 7;

  if (mode === "strict_next") {
    if (delta === 0) delta = 7;
  } else if (mode === "next_week") {
    // Days until end of this week (Sunday-based week ending Saturday? use +7 from this week's occurrence)
    if (delta === 0) delta = 7;
    else delta += 7;
  }

  const target = zonedLocalToDate(now.y, now.m, now.d + delta, 12, 0, timeZone);
  const p = localParts(target, timeZone);
  return { y: p.y, m: p.m, d: p.d };
}

/**
 * When the prompt clearly states a day + time (or morning/evening preset),
 * override model timestamps. Also force "me" → current user.
 */
export function applyPromptHeuristics(
  prompt: string,
  raw: ModelOutput,
  timeZone: string,
  presets?: ShiftPresets,
  self: RosterMember | null = null,
): ModelOutput {
  const out = applySelfReference(prompt, raw, self);

  const explicit = extractTimeRangeFromPrompt(prompt);
  const preset = presets
    ? extractPresetRangeFromPrompt(prompt, presets)
    : null;
  const range = explicit
    ? { ...explicit, label: null as "Morning" | "Evening" | null }
    : preset
      ? {
          startHour: preset.startHour,
          startMin: preset.startMin,
          endHour: preset.endHour,
          endMin: preset.endMin,
          label: preset.label,
        }
      : null;

  const date =
    extractDateFromPrompt(prompt, timeZone) ??
    dateFromModelStart(out, timeZone) ??
    (range ? tomorrowLocal(timeZone) : null);

  if (!range || !date) return out;

  let endDay = date.d;
  let endMonth = date.m;
  let endYear = date.y;
  const startMinTotal = range.startHour * 60 + range.startMin;
  const endMinTotal = range.endHour * 60 + range.endMin;
  if (endMinTotal <= startMinTotal) {
    const next = zonedLocalToDate(date.y, date.m, date.d + 1, 12, 0, timeZone);
    const p = localParts(next, timeZone);
    endYear = p.y;
    endMonth = p.m;
    endDay = p.d;
  }

  const start = zonedLocalToDate(
    date.y,
    date.m,
    date.d,
    range.startHour,
    range.startMin,
    timeZone,
  );
  const end = zonedLocalToDate(
    endYear,
    endMonth,
    endDay,
    range.endHour,
    range.endMin,
    timeZone,
  );

  const dayParts = localParts(start, timeZone);
  const dayLabel = WEEKDAY_NAMES[dayParts.weekday];
  const fmt = (h: number, m: number) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0
      ? `${h12} ${suffix}`
      : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  const timeLabel = range.label
    ? `${range.label} shift (${fmt(range.startHour, range.startMin)}–${fmt(range.endHour, range.endMin)})`
    : `${fmt(range.startHour, range.startMin)}–${fmt(range.endHour, range.endMin)}`;

  const titleOverride =
    range.label &&
    (!out.title ||
      /^(shift|morning shift|evening shift)$/i.test(String(out.title).trim()))
      ? `${range.label} Shift`
      : out.title;

  const who =
    self && out.employee_id === self.id
      ? self.full_name
      : null;

  return {
    ...out,
    title: titleOverride,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    error: null,
    interpretation: who
      ? `${who} — ${dayLabel} ${timeLabel}`
      : `${dayLabel} ${timeLabel}`,
  };
}

export function validateProposal(
  raw: ModelOutput,
  roster: RosterMember[],
): ParsedShiftProposal | ParseShiftFailure {
  if (raw.error && typeof raw.error === "string" && raw.error.trim()) {
    // Heuristics may have filled times; only bail if still missing employee/times
    const hasTimes =
      typeof raw.start_time === "string" &&
      typeof raw.end_time === "string" &&
      raw.start_time &&
      raw.end_time;
    const hasEmployee =
      typeof raw.employee_id === "string" && raw.employee_id.trim();
    if (!hasTimes || !hasEmployee) {
      return { error: raw.error.trim() };
    }
  }

  const employeeId =
    typeof raw.employee_id === "string" ? raw.employee_id.trim() : "";
  const member = roster.find((m) => m.id === employeeId);
  if (!member) {
    return {
      error:
        "Could not match that person to someone on your team. Try their full name.",
    };
  }

  const startRaw =
    typeof raw.start_time === "string" ? raw.start_time.trim() : "";
  const endRaw = typeof raw.end_time === "string" ? raw.end_time.trim() : "";
  const start = new Date(startRaw);
  const end = new Date(endRaw);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      error:
        "Could not understand the date or time. Try something like “tomorrow 9am–5pm”.",
    };
  }
  if (start >= end) {
    return { error: "End time must be after start time." };
  }

  const titleFromModel =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : null;
  const title = titleFromModel ?? (member.designation?.trim() || "Shift");

  const interpretation =
    typeof raw.interpretation === "string" && raw.interpretation.trim()
      ? raw.interpretation.trim()
      : `Assign ${member.full_name} from ${start.toISOString()} to ${end.toISOString()}`;

  return {
    employee_id: member.id,
    employee_name: member.full_name,
    title,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    interpretation,
  };
}

export async function parseShiftFromPrompt(options: {
  prompt: string;
  timezone: string;
  roster: RosterMember[];
  presets?: ShiftPresets;
  self?: RosterMember | null;
}): Promise<ParsedShiftProposal | ParseShiftFailure> {
  const { prompt, timezone, roster } = options;
  const self = options.self ?? null;
  const presets: ShiftPresets = options.presets ?? {
    morning_start: "08:00",
    morning_end: "16:00",
    evening_start: "16:00",
    evening_end: "23:00",
  };

  if (roster.length === 0) {
    return { error: "No team members available to assign." };
  }

  const text = await runChatCompletion([
    {
      role: "system",
      content: buildSystemPrompt(roster, timezone, presets, self),
    },
    { role: "user", content: prompt },
  ]);

  let parsed: ModelOutput;
  try {
    parsed = JSON.parse(stripJsonFences(text)) as ModelOutput;
  } catch {
    return {
      error:
        "Could not understand that request. Try “Add me to next Tuesday evening”.",
    };
  }

  parsed = applyPromptHeuristics(prompt, parsed, timezone, presets, self);
  return validateProposal(parsed, roster);
}
