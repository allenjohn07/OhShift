import { describe, expect, test } from "bun:test";
import { seedOnce } from "./harness";
import { PHRASINGS } from "./phrasings";

const seeded = await seedOnce();
const { routeQuestion, THRESHOLDS } = await import("../../src/lib/ai/router");
const { loadTeam } = await import("../../src/lib/ai/team");
const team = await loadTeam(seeded.a.companyId);

async function evaluate() {
  const wrong: string[] = [];
  let right = 0;
  for (const [question, expected] of PHRASINGS) {
    const decision = await routeQuestion(question, team, { useEmbeddings: false });
    const got = decision.kind === "intent" ? decision.intent.id : null;
    if (got === expected) right++;
    else wrong.push(`${JSON.stringify(question)}  expected=${expected}  got=${got}  top=${decision.ranked.slice(0, 2).map((r) => `${r.id}:${r.score.toFixed(2)}`).join(", ")}`);
  }
  return { right, total: PHRASINGS.length, wrong };
}

describe("router (offline lexical fallback)", () => {
  test("routes labelled phrasings", async () => {
    const { right, total, wrong } = await evaluate();
    console.log(`lexical routing: ${right}/${total} (${((right / total) * 100).toFixed(0)}%)`);
    if (wrong.length) console.log(wrong.join("\n"));
    // The fallback only has to keep the common questions working when Workers AI
    // is down; the embedding router is held to a higher bar by the live eval.
    expect(right / total).toBeGreaterThanOrEqual(0.7);
  });

  test("thresholds are defined for both scorers", () => {
    expect(THRESHOLDS.embedding.min).toBeGreaterThan(THRESHOLDS.embedding.ask);
    expect(THRESHOLDS.lexical.min).toBeGreaterThan(THRESHOLDS.lexical.ask);
  });
});

describe("evaluation hygiene", () => {
  test("no evaluation phrasing appears verbatim in the intent catalogue", async () => {
    const { INTENTS } = await import("../../src/lib/ai/intents");
    const norm = (t: string) => t.toLowerCase().replace(/\{name\}/g, "x").replace(/[^a-z0-9 ]/g, "").trim();
    const catalogue = new Set(INTENTS.flatMap((i) => i.examples.map(norm)));
    const leaked = PHRASINGS.map(([q]) => q).filter((q) => catalogue.has(norm(q)));
    if (leaked.length) console.log("LEAKED:", JSON.stringify(leaked));
    expect(leaked).toEqual([]);
  });
});
