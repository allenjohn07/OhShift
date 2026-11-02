import { fmt12 } from "../format";
import { loadCompanyInfo } from "../team";
import {
  escapeRegExp,
  findPeople,
  joinNames,
  matchTitles,
  roleLabel,
  titlesInUse,
} from "../slots";
import {
  help,
  queryResult,
  type AskResult,
  type ExecContext,
  type TeamMember,
} from "../types";

const OWNER_RE = /\b(owners?|owns|owned|founders?|ceo|proprietors?)\b/i;
const MANAGER_RE = /\b(managers?|manages|managing|management|managed)\b/i;
const LEADERSHIP_RE =
  /\b(boss(?:es)?|in\s+charge|report(?:s|ing)?\s+to|runs?|leads?|leaders?|head\s+of|supervisors?)\b/i;
const EMPLOYEE_RE = /\b(employees?|staff|workers?)\b/i;

/** "store manager", "shift lead", "team supervisor": a title we don't have on file. */
const COMPOUND_TITLE =
  /\b([a-z]{3,})\s+(managers?|leads?|leaders?|supervisors?|owners?)\b/gi;
const NOT_A_TITLE_PREFIX = new Set([
  "the", "our", "your", "their", "his", "her", "its", "who", "whos", "all",
  "any", "some", "other", "new", "current", "that", "this", "which", "what",
  "and", "are", "does", "list", "show", "tell", "give", "has", "have",
]);

const LABEL = "Team roles";

function ownerLine(owners: TeamMember[]): string {
  if (owners.length === 0) return "No owner is set for this company.";
  const names = joinNames(owners.map((o) => o.fullName));
  return owners.length === 1 ? `The owner is ${names}.` : `The owners are ${names}.`;
}

function managersLine(
  managers: TeamMember[],
  owners: TeamMember[],
  opts: { mentionOwner: boolean },
): string {
  if (managers.length === 0) {
    if (owners.length === 0) return "There are no managers assigned.";
    return `There are no managers assigned; ${joinNames(owners.map((o) => o.fullName))} (owner) manages the team.`;
  }
  const names = joinNames(managers.map((m) => m.fullName));
  const line =
    managers.length === 1 ? `The manager is ${names}.` : `The managers are ${names}.`;
  return opts.mentionOwner && owners.length > 0
    ? `${line} ${ownerLine(owners)}`
    : line;
}

function titleLine(title: string, holders: TeamMember[]): string {
  const names = joinNames(holders.map((h) => h.fullName));
  return holders.length === 1
    ? `${names} has the title “${title}”.`
    : `${names} have the title “${title}”.`;
}

const sameTitle = (a: string | null, b: string) =>
  (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** Unknown compound titles in the prompt ("store manager") → names as typed. */
function unknownTitles(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(COMPOUND_TITLE)) {
    const first = m[1]!.toLowerCase();
    if (NOT_A_TITLE_PREFIX.has(first)) continue;
    found.push(`${first} ${m[2]!.toLowerCase().replace(/s$/, "")}`);
  }
  return [...new Set(found)];
}

function capabilityHelp(ctx: ExecContext, lead: string): AskResult {
  const titles = titlesInUse(ctx.team);
  const titleHint =
    titles.length > 0 ? ` Titles on your team: ${joinNames(titles)}.` : "";
  return help(`${lead}${titleHint}`, [
    "Who is the manager?",
    "Who is the owner?",
    ...(titles[0] ? [`Who has the title ${titles[0]}?`] : []),
    "Who is on the team?",
  ]);
}

/** "Who is the manager / owner / boss / shift lead?" */
export async function runRoleLookup(ctx: ExecContext): Promise<AskResult> {
  const { prompt, team } = ctx;
  // "Is Alex the owner?": a yes/no about a named person, not a "who holds it" question.
  if (/^\s*(is|are|does|do)\b/i.test(prompt) && findPeople(prompt, team).people.length > 0) {
    return runPerson(ctx);
  }
  const { titles, rest: afterTitles } = matchTitles(prompt, team);

  // Unknown compound titles ("store manager") are reported, not read as "manager".
  const unknown = unknownTitles(afterTitles);
  const rest = unknown.length
    ? afterTitles.replace(COMPOUND_TITLE, (full, first: string) =>
        NOT_A_TITLE_PREFIX.has(first.toLowerCase()) ? full : " ",
      )
    : afterTitles;

  const wantsOwner = OWNER_RE.test(rest);
  const wantsManagers = MANAGER_RE.test(rest);
  const wantsLeadership = LEADERSHIP_RE.test(rest);

  const owners = team.filter((m) => m.role === "owner");
  const managers = team.filter((m) => m.role === "manager");

  const parts: string[] = [];
  if (wantsOwner) parts.push(ownerLine(owners));
  if (wantsManagers) {
    parts.push(
      managersLine(managers, owners, { mentionOwner: !wantsOwner && !wantsLeadership }),
    );
  }
  if (wantsLeadership && !wantsOwner && !wantsManagers) {
    parts.push(ownerLine(owners), managersLine(managers, [], { mentionOwner: false }));
  }
  for (const title of titles) {
    parts.push(
      titleLine(title, team.filter((m) => sameTitle(m.designation, title))),
    );
  }
  for (const title of unknown) {
    parts.push(`I couldn't find anyone with the title “${title}”.`);
  }

  if (parts.length === 0) {
    // Maybe a person question that was routed here.
    const { people, ambiguous } = findPeople(prompt, team);
    if (people.length > 0 || ambiguous.length > 0) return runPerson(ctx);
    return capabilityHelp(ctx, "I couldn't tell which role you mean.");
  }

  const named = unknown.length > 0 && parts.length === unknown.length;
  return named
    ? capabilityHelp(ctx, parts.join(" "))
    : queryResult({ answer: parts.join(" "), window_label: LABEL });
}

/** Replace the shared name token with each candidate's full name. */
function disambiguate(prompt: string, candidates: TeamMember[]): string[] {
  const parts = (m: TeamMember) => m.fullName.toLowerCase().split(/\s+/);
  const tokens = parts(candidates[0]!).filter((t) =>
    candidates.every((c) => parts(c).includes(t)),
  );
  const token = tokens.find((t) =>
    new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(prompt),
  );
  return candidates.map((c) =>
    token
      ? prompt.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "i"), c.fullName)
      : `Tell me about ${c.fullName}`,
  );
}

/** "Who is Priya?" / "Is Priya a manager?" / "What does Sam do?" */
export async function runPerson(ctx: ExecContext): Promise<AskResult> {
  const { prompt, team } = ctx;
  const { people, ambiguous } = findPeople(prompt, team);

  if (ambiguous.length > 0) {
    return help(
      `Which one do you mean: ${joinNames(ambiguous.map((a) => a.fullName))}?`,
      disambiguate(prompt, ambiguous),
    );
  }

  if (people.length === 0) {
    const { titles } = matchTitles(prompt, team);
    if (OWNER_RE.test(prompt) || MANAGER_RE.test(prompt) || LEADERSHIP_RE.test(prompt) || titles.length > 0) {
      return runRoleLookup(ctx);
    }
    return capabilityHelp(ctx, "I couldn't find that person on your team.");
  }

  // "Is X a manager?" → yes/no when exactly one role/title is being asked about.
  const { titles: askedTitles, rest } = matchTitles(prompt, team);
  const askedRoles = [
    OWNER_RE.test(rest) ? "owner" : null,
    MANAGER_RE.test(rest) ? "manager" : null,
    EMPLOYEE_RE.test(rest) ? "employee" : null,
  ].filter(Boolean) as TeamMember["role"][];
  const askCount = askedRoles.length + askedTitles.length;

  const lines = people.map((p) => {
    const titlePart = p.designation ? ` with the title “${p.designation}”` : "";
    const fact = `${p.fullName} is ${roleLabel(p.role)}${titlePart}.`;
    if (askCount !== 1) return fact;
    const matches = askedRoles.length
      ? askedRoles[0] === p.role
      : sameTitle(p.designation, askedTitles[0]!);
    return `${matches ? "Yes" : "No"}, ${fact}`;
  });

  return queryResult({
    answer: lines.join(" "),
    window_label: LABEL,
    person: people.length === 1 ? people[0]!.fullName : null,
  });
}

/** "Who is on the team?" / "How many people work here?" */
export async function runTeamList(ctx: ExecContext): Promise<AskResult> {
  const { team } = ctx;
  if (team.length === 0) {
    return queryResult({ answer: "There is no one on the team yet.", window_label: "Team" });
  }
  const count = (role: TeamMember["role"]) => team.filter((m) => m.role === role).length;
  const breakdown = [
    count("owner") ? `${count("owner")} owner` : "",
    count("manager") ? `${count("manager")} manager${count("manager") === 1 ? "" : "s"}` : "",
    count("employee") ? `${count("employee")} employee${count("employee") === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  const MAX = 40;
  const shown = team.slice(0, MAX).map((m) => {
    const bits = [m.role !== "employee" ? m.role : null, m.designation].filter(Boolean);
    return bits.length ? `${m.fullName} (${bits.join(", ")})` : m.fullName;
  });
  const more = team.length > MAX ? `, and ${team.length - MAX} more` : "";

  return queryResult({
    answer: `Your team has ${team.length} ${team.length === 1 ? "person" : "people"} (${breakdown.join(", ")}): ${shown.join("; ")}${more}.`,
    window_label: "Team",
  });
}

/** "What time is the morning shift?" / "What's the company name?" */
export async function runCompanyInfo(ctx: ExecContext): Promise<AskResult> {
  const { name, presets } = await loadCompanyInfo(ctx.principal.companyId);
  const p = presets;
  return queryResult({
    answer: `${name}: the morning shift is ${fmt12(p.morning_start)}–${fmt12(p.morning_end)} and the evening shift is ${fmt12(p.evening_start)}–${fmt12(p.evening_end)}.`,
    window_label: "Company",
  });
}
