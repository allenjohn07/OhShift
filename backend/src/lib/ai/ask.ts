import { findKnowledge } from "./executors/announcements";
import { INTENTS } from "./intents";
import { guardResult } from "./redact";
import { routeQuestion } from "./router";
import { loadCompanyInfo, loadTeam } from "./team";
import {
  help,
  type AiRole,
  type AskResult,
  type ExecContext,
  type IntentId,
  type Principal,
} from "./types";

/**
 * Intent matches scoring below this (embedding scale, after priors) are "soft":
 * genuine operational questions in the evaluation score 0.86+; the content
 * questions that got misrouted scored 0.72–0.78.
 */
const SOFT_INTENT_SCORE = 0.85;

/** Which suggestion chips to offer, in order (only ones the role may use). */
const SUGGESTION_ORDER: IntentId[] = [
  "shifts.mine",
  "shifts.who_working",
  "org.role_lookup",
  "availability.who",
  "timeoff.team",
  "timeoff.mine",
  "hours.team",
  "hours.mine",
  "announcements.search",
  "team.list",
];

export function suggestionsFor(role: AiRole, limit = 5): string[] {
  const allowed = new Map(
    INTENTS.filter((i) => i.roles.includes(role)).map((i) => [i.id, i.suggest]),
  );
  return SUGGESTION_ORDER.flatMap((id) => {
    const s = allowed.get(id);
    return s ? [s] : [];
  }).slice(0, limit);
}

export async function ask(options: {
  principal: Principal;
  prompt: string;
  timezone: string;
  now?: Date;
  /** Tests / offline runs can skip the embedding call. */
  useEmbeddings?: boolean;
}): Promise<AskResult> {
  const { principal, prompt, timezone } = options;
  const started = Date.now();

  const [team, company] = await Promise.all([
    loadTeam(principal.companyId),
    loadCompanyInfo(principal.companyId),
  ]);
  const ctx: ExecContext = {
    principal,
    prompt,
    timezone,
    team,
    presets: company.presets,
    now: options.now ?? new Date(),
  };

  const decision = await routeQuestion(prompt, team, {
    useEmbeddings: options.useEmbeddings,
  });

  // Counts and routing only: never the question or the answer.
  const audit = (outcome: string, intent: string | null) =>
    console.info(
      JSON.stringify({
        ai: "ask",
        role: principal.role,
        intent,
        via: decision.via,
        outcome,
        ms: Date.now() - started,
      }),
    );

  if (decision.kind === "unsupported") {
    audit("unsupported", null);
    return help(decision.message, suggestionsFor(principal.role));
  }

  // Share the question's embedding with the announcement lookup (no second AI call).
  ctx.queryVector = decision.queryVector;

  if (decision.kind === "none") {
    // Not an operational question: it may be about what management announced.
    const knowledge = await findKnowledge(ctx, "fallback");
    if (knowledge) {
      audit("knowledge_fallback", "announcements.search");
      return guardResult(knowledge);
    }
    audit("no_match", null);
    return help(
      "I'm not sure what you're asking. Here are some things I can answer:",
      suggestionsFor(principal.role),
    );
  }

  const { intent } = decision;

  // A weak operational match ("what should I wear to work" → my shifts) gets a second
  // opinion from the announcements before we commit, and before any role check.
  if (
    intent.id !== "announcements.search" &&
    decision.via !== "fast" &&
    decision.queryVector &&
    decision.score < SOFT_INTENT_SCORE
  ) {
    const knowledge = await findKnowledge(ctx, "second_opinion");
    if (knowledge) {
      audit("knowledge_second_opinion", "announcements.search");
      return guardResult(knowledge);
    }
  }

  if (!intent.roles.includes(principal.role)) {
    audit("denied", intent.id);
    return help(
      intent.id === "shifts.create"
        ? "Only managers can create or change shifts. Ask your manager to add it."
        : "That's only available to managers. Here's what I can tell you:",
      suggestionsFor(principal.role),
    );
  }

  const result = await intent.run(ctx);
  audit("ok", intent.id);
  return guardResult(result);
}
