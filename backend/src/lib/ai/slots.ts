import type { TeamMember } from "./types";

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export const roleLabel = (role: TeamMember["role"]) =>
  role === "owner" ? "the owner" : role === "manager" ? "a manager" : "an employee";

export type PersonMatch = {
  /** People the prompt clearly names. */
  people: TeamMember[];
  /** When a first/last name fits more than one person: the candidates. */
  ambiguous: TeamMember[];
};

/**
 * Find team members named in the prompt. Full names win; otherwise a first or
 * last name counts only when it is unambiguous. Used only after the intent is
 * known to need a person, so ordinary words that are also names ("Will", "May")
 * don't cause false matches elsewhere.
 */
export function findPeople(prompt: string, team: TeamMember[]): PersonMatch {
  const lower = prompt.toLowerCase();

  const full = team.filter((m) => {
    const name = m.fullName.toLowerCase().trim();
    return name.length >= 2 && lower.includes(name);
  });
  if (full.length > 0) return { people: full, ambiguous: [] };

  // token → members that own that token
  const byToken = new Map<string, TeamMember[]>();
  const add = (token: string, member: TeamMember) => {
    const list = byToken.get(token) ?? [];
    if (!list.includes(member)) list.push(member);
    byToken.set(token, list);
  };
  for (const m of team) {
    const parts = m.fullName.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (parts[0] && parts[0].length >= 2) add(parts[0], m);
    const last = parts.length > 1 ? parts[parts.length - 1]! : "";
    if (last.length >= 3) add(last, m);
  }

  const people: TeamMember[] = [];
  let ambiguous: TeamMember[] = [];
  for (const [token, members] of byToken) {
    if (!new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(lower)) continue;
    if (members.length === 1) {
      if (!people.includes(members[0]!)) people.push(members[0]!);
    } else if (ambiguous.length === 0) {
      ambiguous = members;
    }
  }
  // A resolved person beats an ambiguous token ("Sam Rivera" vs another "Sam").
  if (people.length > 0) return { people, ambiguous: [] };
  return { people: [], ambiguous };
}

/** Distinct job titles (designations) in use, as written in the company. */
export function titlesInUse(team: TeamMember[]): string[] {
  const seen = new Map<string, string>();
  for (const m of team) {
    const d = m.designation?.trim();
    if (d && !seen.has(d.toLowerCase())) seen.set(d.toLowerCase(), d);
  }
  return [...seen.values()];
}

/** Regex for a title that tolerates plurals and flexible spacing ("shift lead(s)"). */
function titleRegex(title: string): RegExp {
  const words = title.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  return new RegExp(`\\b${words}(?:s|es)?\\b`, "i");
}

/**
 * Titles mentioned in the prompt, plus the prompt with those mentions removed
 * (so "lead" inside "shift lead" isn't also read as "who is the leader").
 */
export function matchTitles(
  prompt: string,
  team: TeamMember[],
): { titles: string[]; rest: string } {
  let rest = prompt;
  const titles: string[] = [];
  // Longest first so "senior barista" beats "barista".
  const sorted = [...titlesInUse(team)].sort((a, b) => b.length - a.length);
  for (const title of sorted) {
    const re = titleRegex(title);
    if (re.test(rest)) {
      titles.push(title);
      rest = rest.replace(new RegExp(titleRegex(title).source, "ig"), " ");
    }
  }
  return { titles, rest };
}
