/**
 * Live router evaluation. Run (in backend/):
 *   bunx wrangler dev -c scripts/ai-eval/wrangler.toml --port 3098
 *   curl -s localhost:3098 | bun scripts/ai-eval/report.ts
 * Uses your Cloudflare account's Workers AI (a few hundred tiny embedding calls).
 */
import { PHRASINGS } from "../../test/ai/phrasings";
import { embeddingText } from "../../src/lib/ai/announcement-index";
import { routeQuestion, THRESHOLDS } from "../../src/lib/ai/router";
import type { TeamMember } from "../../src/lib/ai/types";
import { cosineSimilarity, runEmbedding } from "../../src/lib/workers-ai";

/** Sample announcements + content questions, for calibrating the knowledge fallback. */
const ANNOUNCEMENTS: Array<[string, string]> = [
  ["Holiday schedule", "We will be closed on December 25th and open 10am to 2pm on December 24th for the holidays."],
  ["Parking change", "Starting Monday, staff parking moves to Lot B behind the building. Lot A is for customers only."],
  ["New menu launch", "Our winter menu launches Friday: peppermint mocha and gingerbread latte. Please review the recipe cards."],
  ["Staff meeting Friday", "All-hands staff meeting this Friday at 3pm in the back room. Attendance is required."],
  ["Dress code reminder", "Please wear your black aprons and closed-toe shoes on every shift."],
  ["Tip pool update", "Starting next pay period tips will be split by hours worked rather than evenly."],
];
const KNOWLEDGE_QUESTIONS: Array<[string, string]> = [
  ["what did we announce about the holidays", "Holiday schedule"],
  ["are we open on christmas eve", "Holiday schedule"],
  ["where should I park", "Parking change"],
  ["can I park in lot a", "Parking change"],
  ["what's the new drinks menu", "New menu launch"],
  ["what drinks are we launching", "New menu launch"],
  ["when is the team meeting", "Staff meeting Friday"],
  ["is the staff meeting mandatory", "Staff meeting Friday"],
  ["what should I wear to work", "Dress code reminder"],
  ["do I need a black apron", "Dress code reminder"],
  ["how are tips divided", "Tip pool update"],
  ["how do tips work now", "Tip pool update"],
];

const TEAM: TeamMember[] = [
  { id: "1", fullName: "Alex Morgan", role: "owner", designation: null },
  { id: "2", fullName: "Priya Patel", role: "manager", designation: "Shift Lead" },
  { id: "3", fullName: "Sam Rivera", role: "employee", designation: "Barista" },
  { id: "4", fullName: "Jordan Lee", role: "employee", designation: "Barista" },
  { id: "5", fullName: "Mo Hassan", role: "employee", designation: "Cashier" },
  { id: "6", fullName: "Sam Okafor", role: "employee", designation: "Cashier" },
];

async function knowledge() {
  const docs = await runEmbedding(ANNOUNCEMENTS.map(([title, body]) => embeddingText({ title, body })));
  const rows = [];
  const questions: Array<[string, string | null]> = [
    ...KNOWLEDGE_QUESTIONS,
    ...PHRASINGS.map(([q]) => [q, null] as [string, string | null]),
  ];
  for (const [question, expected] of questions) {
    const [q] = await runEmbedding([question]);
    const sims = docs.map((d, i) => ({ title: ANNOUNCEMENTS[i]![0], score: Number(cosineSimilarity(q!, d).toFixed(4)) }));
    sims.sort((a, b) => b.score - a.score);
    const route = await routeQuestion(question, TEAM);
    rows.push({
      question,
      expectedAnnouncement: expected,
      bestAnnouncement: sims[0]!,
      secondAnnouncement: sims[1]!,
      route: route.kind === "intent" ? route.intent.id : route.kind,
      routeVia: route.via,
      routeTop: route.ranked[0] ? Number(route.ranked[0].score.toFixed(4)) : null,
    });
  }
  return rows;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/knowledge") return Response.json(await knowledge());
    const results = [];
    for (const [question, expected] of PHRASINGS) {
      const started = Date.now();
      const d = await routeQuestion(question, TEAM);
      results.push({
        question,
        expected,
        got: d.kind === "intent" ? d.intent.id : null,
        via: d.via,
        top: d.ranked.slice(0, 3).map((r) => ({ id: r.id, score: Number(r.score.toFixed(4)) })),
        ms: Date.now() - started,
      });
    }
    return Response.json({ thresholds: THRESHOLDS, results });
  },
};
