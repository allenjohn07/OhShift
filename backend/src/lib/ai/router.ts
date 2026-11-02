import { runChatCompletion, runEmbedding, cosineSimilarity } from "../workers-ai";
import { isOrgRoleQuery, looksLikeQuery } from "../nl-schedule-ask";
import { INTENTS, INTENT_BY_ID } from "./intents";
import { unsupportedRequest } from "./guards";
import { tokenize } from "./text";
import { escapeRegExp, findPeople } from "./slots";
import type { Intent, IntentId, TeamMember } from "./types";

export type Ranked = { id: IntentId; score: number };
export type RouteVia = "fast" | "embedding" | "lexical" | "model";

export type RouteDecision =
  | {
      kind: "intent";
      intent: Intent;
      via: RouteVia;
      score: number;
      ranked: Ranked[];
      /** Set when the embedding scorer ran. */
      queryVector?: number[];
    }
  /** A request to change something: answered with where to do it, never matched to a lookup. */
  | { kind: "unsupported"; message: string; via: "fast"; ranked: Ranked[] }
  | { kind: "none"; via: "embedding" | "lexical"; ranked: Ranked[]; queryVector?: number[] };

/**
 * Confidence needed to act without asking the model. Embedding cosine scores
 * and lexical TF-IDF scores live on different scales, so each has its own.
 * Tuned with `scripts/ai-eval` (see worker.ts); re-run it before changing these.
 */
export const THRESHOLDS = {
  embedding: { min: 0.72, margin: 0.025, ask: 0.6 },
  lexical: { min: 0.5, margin: 0.1, ask: 0.3 },
} as const;

// ───────────────────────── lexical scorer (offline fallback) ─────────────────

/** Replace team members' names with the placeholder token examples use. */
export function maskNames(prompt: string, team: TeamMember[]): string {
  let out = prompt;
  const parts = new Set<string>();
  for (const m of team) {
    const lower = m.fullName.toLowerCase().trim();
    if (lower.length >= 2) {
      out = out.replace(new RegExp(escapeRegExp(lower), "ig"), " {name} ");
    }
    const tokens = lower.split(/\s+/);
    if (tokens[0] && tokens[0].length >= 2) parts.add(tokens[0]);
    if (tokens.length > 1 && tokens[tokens.length - 1]!.length >= 3) {
      parts.add(tokens[tokens.length - 1]!);
    }
  }
  for (const token of parts) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "ig"), " {name} ");
  }
  return out;
}

type LexDoc = { id: IntentId; vec: Map<string, number>; norm: number };
type LexIndex = { idf: Map<string, number>; maxIdf: number; docs: LexDoc[] };

function buildLexIndex(intents: Intent[]): LexIndex {
  const tokenized = intents.flatMap((intent) =>
    intent.examples.map((ex) => ({ id: intent.id, tokens: tokenize(ex) })),
  );
  const df = new Map<string, number>();
  for (const { tokens } of tokenized) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = tokenized.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 1)) + 1);
  const maxIdf = Math.log(n + 1) + 1;

  const docs = tokenized.map(({ id, tokens }) => {
    const vec = new Map<string, number>();
    for (const t of tokens) vec.set(t, (vec.get(t) ?? 0) + idf.get(t)!);
    const norm = Math.sqrt([...vec.values()].reduce((s, v) => s + v * v, 0));
    return { id, vec, norm };
  });
  return { idf, maxIdf, docs };
}

let lexIndex: LexIndex | null = null;

export function lexicalRank(prompt: string, team: TeamMember[]): Ranked[] {
  lexIndex ??= buildLexIndex(INTENTS);
  const { idf, maxIdf, docs } = lexIndex;

  const query = new Map<string, number>();
  let unknownWeight = 0;
  for (const t of tokenize(maskNames(prompt, team))) {
    const w = idf.get(t);
    if (w === undefined) unknownWeight += maxIdf * maxIdf; // unknown words dilute the match
    else query.set(t, (query.get(t) ?? 0) + w);
  }
  const qNorm = Math.sqrt(
    [...query.values()].reduce((s, v) => s + v * v, 0) + unknownWeight,
  );
  if (qNorm === 0) return INTENTS.map((i) => ({ id: i.id, score: 0 }));

  const best = new Map<IntentId, number>();
  for (const doc of docs) {
    let dot = 0;
    for (const [t, w] of query) dot += w * (doc.vec.get(t) ?? 0);
    const score = doc.norm ? dot / (qNorm * doc.norm) : 0;
    if (score > (best.get(doc.id) ?? 0)) best.set(doc.id, score);
  }
  return INTENTS.map((i) => ({ id: i.id, score: best.get(i.id) ?? 0 })).sort(
    (a, b) => b.score - a.score,
  );
}

// ───────────────────────── embedding scorer ─────────────────────────────────

const SAMPLE_NAMES = ["Priya", "Sam", "Mo", "Jordan", "Alex", "Casey"];
const expandExample = (example: string, i: number) =>
  example.replace(/\{name\}/g, SAMPLE_NAMES[i % SAMPLE_NAMES.length]!);

type EmbeddingIndex = { ids: IntentId[]; vectors: number[][] };
let embeddingIndex: Promise<EmbeddingIndex> | null = null;

/** Embeds every example once per isolate (one or two batched calls, cached). */
function getEmbeddingIndex(): Promise<EmbeddingIndex> {
  if (!embeddingIndex) {
    const pending = (async () => {
      const ids: IntentId[] = [];
      const texts: string[] = [];
      for (const intent of INTENTS) {
        intent.examples.forEach((ex, i) => {
          ids.push(intent.id);
          texts.push(expandExample(ex, i));
        });
      }
      return { ids, vectors: await runEmbedding(texts) };
    })();
    embeddingIndex = pending;
    pending.catch(() => {
      if (embeddingIndex === pending) embeddingIndex = null; // retry next request
    });
  }
  return embeddingIndex;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Embedding timed out")), ms);
    promise.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}

export async function embeddingRank(
  prompt: string,
): Promise<{ ranked: Ranked[]; vector: number[] }> {
  const [index, [query]] = await withTimeout(
    Promise.all([getEmbeddingIndex(), runEmbedding([prompt])]),
    8000,
  );
  const best = new Map<IntentId, number>();
  index.vectors.forEach((vec, i) => {
    const score = cosineSimilarity(query!, vec);
    const id = index.ids[i]!;
    if (score > (best.get(id) ?? -1)) best.set(id, score);
  });
  const ranked = INTENTS.map((i) => ({ id: i.id, score: best.get(i.id) ?? 0 })).sort(
    (a, b) => b.score - a.score,
  );
  return { ranked, vector: query! };
}

// ───────────────────────── slot-compatibility priors ────────────────────────

type Signals = { named: boolean; self: boolean; asksWho: boolean };

function signalsFor(prompt: string, team: TeamMember[]): Signals {
  const { people, ambiguous } = findPeople(prompt, team);
  return {
    named: people.length > 0 || ambiguous.length > 0,
    self: /\b(my|me|mine|myself|i)\b/i.test(prompt),
    asksWho: /\b(who|who's|whos|anyone|anybody|everyone|everybody)\b|\bwhich\s+(employees|staff|people|workers)\b/i.test(prompt),
  };
}

/** How well the question's shape fits an intent's focus, in [-1, 1]. */
function prior(focus: Intent["focus"], s: Signals): number {
  switch (focus) {
    case "none":
      return 0;
    case "person":
      return s.named ? 1 : -1;
    case "self":
      return s.named ? -1 : s.self ? 1 : -0.6;
    case "team":
      if (s.named) return -0.6;
      if (s.self && !s.asksWho) return -0.6;
      return s.asksWho ? 0.5 : 0;
    case "person_or_self":
      return s.named ? 1 : s.self ? 0.8 : -0.8;
    case "team_or_person":
      if (s.named) return 0.6;
      if (s.self && !s.asksWho) return -0.6;
      return s.asksWho ? 0.5 : 0;
  }
}

/** Similarity says *what* is asked; the question's shape says *about whom*. */
const PRIOR_SCALE = { embedding: 0.05, lexical: 0.15 } as const;
/** A topic word ("vacation", "hours") in the question: a stronger, rarer signal. */
const CUE_SCALE = { embedding: 0.1, lexical: 0.2 } as const;

export function applyPriors(
  ranked: Ranked[],
  prompt: string,
  team: TeamMember[],
  via: "embedding" | "lexical",
): Ranked[] {
  const signals = signalsFor(prompt, team);
  return ranked
    .map((r) => ({
      id: r.id,
      score:
        r.score +
        prior(INTENT_BY_ID.get(r.id)!.focus, signals) * PRIOR_SCALE[via] +
        (INTENT_BY_ID.get(r.id)!.cues?.test(prompt) ? CUE_SCALE[via] : 0),
    }))
    .sort((a, b) => b.score - a.score);
}

// ───────────────────────── decision ─────────────────────────────────────────

/** Unambiguous patterns that need no similarity search. */
function fastIntent(prompt: string, team: TeamMember[]): IntentId | null {
  if (isOrgRoleQuery(prompt)) return "org.role_lookup";
  if (looksLikeQuery(prompt)) return null;

  const lower = prompt.toLowerCase();
  if (/\b(add|assign|create|put|book)\b/.test(lower)) return "shifts.create";
  // "schedule me / schedule Sam": only when the word after it really is a person.
  const word = /\bschedule\s+([a-z][a-z'-]*)\b/.exec(lower)?.[1];
  if (
    word &&
    (word === "me" ||
      word === "myself" ||
      team.some((m) => m.fullName.toLowerCase().split(/\s+/).includes(word)))
  ) {
    return "shifts.create";
  }
  return null;
}

async function askModelToPick(prompt: string, candidates: Intent[]): Promise<IntentId | null> {
  try {
    const text = await runChatCompletion([
      {
        role: "system",
        content: `Pick which intent best matches the user's question. Reply ONLY with JSON like {"intent":"<id>"}, or {"intent":"none"} if none fit.
Intents:
${candidates.map((c) => `- ${c.id}: ${c.about}`).join("\n")}`,
      },
      { role: "user", content: prompt },
    ]);
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?|```$/gim, "").trim()) as {
      intent?: string;
    };
    // Only ever accept an id from the candidate list.
    return candidates.find((c) => c.id === parsed.intent)?.id ?? null;
  } catch {
    return null;
  }
}

export async function routeQuestion(
  prompt: string,
  team: TeamMember[],
  options: { useEmbeddings?: boolean } = {},
): Promise<RouteDecision> {
  const unsupported = unsupportedRequest(prompt);
  if (unsupported) {
    return { kind: "unsupported", message: unsupported, via: "fast", ranked: [] };
  }

  const fast = fastIntent(prompt, team);
  if (fast) {
    const intent = INTENT_BY_ID.get(fast);
    if (intent) return { kind: "intent", intent, via: "fast", score: 1, ranked: [] };
  }

  let ranked: Ranked[];
  let queryVector: number[] | undefined;
  let via: "embedding" | "lexical" = "lexical";
  if (options.useEmbeddings !== false) {
    try {
      ({ ranked, vector: queryVector } = await embeddingRank(prompt));
      via = "embedding";
    } catch (err) {
      console.error("AI routing: embeddings unavailable, using lexical fallback", err);
      ranked = lexicalRank(prompt, team);
    }
  } else {
    ranked = lexicalRank(prompt, team);
  }
  ranked = applyPriors(ranked, prompt, team, via);

  const limits = THRESHOLDS[via];
  const [top, second] = ranked;
  if (top && top.score >= limits.min && top.score - (second?.score ?? 0) >= limits.margin) {
    return { kind: "intent", intent: INTENT_BY_ID.get(top.id)!, via, score: top.score, ranked, queryVector };
  }

  // Not clear-cut: let the 3B model choose between the top few, nothing else.
  if (top && top.score >= limits.ask) {
    const candidates = ranked
      .slice(0, 3)
      .map((r) => INTENT_BY_ID.get(r.id)!)
      .filter(Boolean);
    const picked = await askModelToPick(prompt, candidates);
    if (picked) {
      return {
        kind: "intent",
        intent: INTENT_BY_ID.get(picked)!,
        via: "model",
        score: ranked.find((r) => r.id === picked)?.score ?? 0,
        ranked,
        queryVector,
      };
    }
  }
  return { kind: "none", via, ranked, queryVector };
}
