import type { ParsedShiftProposal } from "../nl-shift-parse";
import type { ShiftPresets } from "../nl-shift-parse";
import type { serializeShift } from "../serialize";

export type AiRole = "employee" | "manager" | "owner";

/**
 * Who is asking. Every executor scopes by this (it comes from the verified JWT
 * session) — never by anything in the prompt or the model's output.
 */
export type Principal = {
  userId: string;
  companyId: string;
  role: AiRole;
  fullName: string;
};

export const isManagerPrincipal = (p: Principal) => p.role !== "employee";

/** A person on the team as the assistant may see them (no email, hash, avatar…). */
export type TeamMember = {
  id: string;
  fullName: string;
  role: AiRole;
  designation: string | null;
};

export type SerializedShift = ReturnType<typeof serializeShift>;

export type AnnouncementSource = {
  id: string;
  title: string;
  created_at: string;
  author: string | null;
};

// ── Results (the shape /ai/ask returns) ──

export type AskCreate = { kind: "create"; proposal: ParsedShiftProposal };

export type AskQuery = {
  kind: "query";
  answer: string;
  /** Label for the resolved window / topic, shown above the answer */
  window_label: string;
  person: string | null;
  /** "schedule" answers come with the shifts they list; the UI shows them */
  topic: "schedule" | "other";
  shifts: SerializedShift[];
  /** Announcements an answer is based on (search answers) */
  sources: AnnouncementSource[];
};

/**
 * No direct answer, but never blank: explains what's missing or not allowed
 * and offers questions that do work for this person.
 */
export type AskHelp = {
  kind: "help";
  answer: string;
  suggestions: string[];
};

/** `kind` is declared (never set) so `result.kind` narrows the whole union. */
export type AskFailure = { error: string; kind?: undefined };

export type AskResult = AskCreate | AskQuery | AskHelp | AskFailure;

// ── Executor plumbing ──

export type ExecContext = {
  principal: Principal;
  prompt: string;
  timezone: string;
  team: TeamMember[];
  presets: ShiftPresets;
  /** Injectable for tests. */
  now: Date;
  /** The question's embedding, when routing already computed it (saves a call). */
  queryVector?: number[];
};

export type IntentId =
  | "org.role_lookup"
  | "org.person"
  | "team.list"
  | "company.info"
  | "shifts.who_working"
  | "shifts.person"
  | "shifts.mine"
  | "shifts.off"
  | "shifts.create"
  | "availability.person"
  | "availability.who"
  | "timeoff.mine"
  | "timeoff.team"
  | "hours.mine"
  | "hours.team"
  | "announcements.search";

export type Intent = {
  id: IntentId;
  /** Roles allowed to use it; anyone else gets a polite "not available to you". */
  roles: AiRole[];
  /**
   * Example phrasings: also the routing index. Write them how people type;
   * `{name}` stands for any person's name.
   */
  examples: string[];
  /**
   * Whose data the question is about. Used as a routing prior: a person's name
   * in the question favours "person", "my/me/I" favours "self", "who…" favours
   * "team". `_or_` forms accept either.
   */
  focus: "none" | "person" | "self" | "team" | "person_or_self" | "team_or_person";
  /**
   * Topic words that signal this intent's domain ("vacation", "hours",
   * "available"). A match nudges the routing score; embeddings alone can lean on
   * a question's shape and miss a rare but decisive word.
   */
  cues?: RegExp;
  /** One line describing what the intent answers (shown to the model when it must break a tie). */
  about: string;
  /** Short question shown as a suggestion chip. */
  suggest: string;
  run: (ctx: ExecContext) => Promise<AskResult>;
};

export function help(answer: string, suggestions: string[] = []): AskHelp {
  return { kind: "help", answer, suggestions };
}

export function queryResult(
  fields: Partial<Omit<AskQuery, "kind">> & Pick<AskQuery, "answer" | "window_label">,
): AskQuery {
  return {
    kind: "query",
    person: null,
    topic: "other",
    shifts: [],
    sources: [],
    ...fields,
  };
}
