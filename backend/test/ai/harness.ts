/**
 * Test harness: swaps the Workers-only modules for an in-memory SQLite database
 * (real migrations applied) so the real executors, router and guards run in
 * `bun test`. Import this FIRST in every test, then dynamic-import app modules.
 */
import { createClient } from "@libsql/client";
import { mock } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../src/db/schema";

const client = createClient({ url: ":memory:" });
export const testDb = drizzle(client, { schema });
await migrate(testDb, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });

// `env.AI` is undefined → embeddings/chat fail → the assistant must still work
// (lexical routing, deterministic answers).
mock.module("cloudflare:workers", () => ({ env: {} }));
mock.module("../../src/db", () => ({ db: testDb, schema }));

// Workers AI stand-in. Embeddings are a deterministic bag-of-words (shared words →
// similar vectors); chat is off unless a test sets `fakeAi.chat`.
const vocab = new Map<string, number>();
const DIMS = 1024;
export const fakeAi: {
  embedFails: boolean;
  chat: null | ((messages: Array<{ role: string; content: string }>) => string);
} = { embedFails: false, chat: null };

const GENERIC = new Set(["what", "that", "this", "with", "from", "about", "have", "does", "were", "anything", "announce", "announced", "announcement", "announcements", "where", "when", "which", "there", "their", "tell", "latest", "told"]);

/** Bag-of-words with the first line (the title) weighted 3×, like a real model leans on titles. */
function fakeEmbed(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  const [title = "", ...rest] = text.toLowerCase().split("\n");
  const add = (chunk: string, weight: number) => {
    for (const token of chunk.match(/[a-z0-9]{4,}/g) ?? []) {
      if (GENERIC.has(token)) continue;
      if (!vocab.has(token)) vocab.set(token, vocab.size % DIMS);
      v[vocab.get(token)!]! += weight;
    }
  };
  add(title, 3);
  add(rest.join(" "), 1);
  return v;
}

mock.module("../../src/lib/workers-ai", () => ({
  EMBEDDING_MODEL: "fake-embedding",
  NL_SHIFT_MODEL: "fake-chat",
  runEmbedding: async (texts: string[]) => {
    if (fakeAi.embedFails) throw new Error("Workers AI is down");
    return texts.map(fakeEmbed);
  },
  runChatCompletion: async (messages: Array<{ role: string; content: string }>) => {
    if (!fakeAi.chat) throw new Error("Workers AI is down");
    return fakeAi.chat(messages);
  },
  cosineSimilarity: (a: number[], b: number[]) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  },
}));

// Per-question audit lines (console.info) are noise in test output.
console.info = () => {};

export { schema };

// ───────────────────────── seed ─────────────────────────

/** Strings that must never appear in any answer. */
export const CANARIES = {
  email: "canary-email",
  hash: "pbkdf2$CANARY",
  timeOffNote: "CANARY-TIMEOFF-NOTE",
  reviewNote: "CANARY-REVIEW-NOTE",
  dm: "CANARY-DM-BODY",
  invite: "CANARY-INVITE",
} as const;

const DAY = 86_400_000;
export const at = (daysFromToday: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d;
};
export const dateOnly = (daysFromToday: number) => {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() + daysFromToday * DAY);
};

async function makeCompany(name: string, people: Array<{ key: string; name: string; role: "owner" | "manager" | "employee"; title?: string }>) {
  const ids: Record<string, string> = {};
  for (const p of people) {
    const [u] = await testDb
      .insert(schema.users)
      .values({
        fullName: p.name,
        email: `${CANARIES.email}-${p.key}@secret.test`,
        passwordHash: `${CANARIES.hash}${p.key}`,
        role: p.role,
        designation: p.title ?? null,
        avatarUrl: `https://img.test/${CANARIES.invite}-${p.key}.png`,
      })
      .returning();
    ids[p.key] = u!.id;
  }
  const ownerKey = people.find((p) => p.role === "owner")!.key;
  const [company] = await testDb
    .insert(schema.companies)
    .values({ name, ownerId: ids[ownerKey]! })
    .returning();
  for (const key of Object.keys(ids)) {
    await testDb
      .update(schema.users)
      .set({ companyId: company!.id })
      .where(eq(schema.users.id, ids[key]!));
  }
  return { companyId: company!.id, ids };
}

async function seed() {
  // Company A: the one under test.
  const a = await makeCompany("Brew & Co.", [
    { key: "alex", name: "Alex Morgan", role: "owner" },
    { key: "priya", name: "Priya Patel", role: "manager", title: "Shift Lead" },
    { key: "sam", name: "Sam Rivera", role: "employee", title: "Barista" },
    { key: "jordan", name: "Jordan Lee", role: "employee", title: "Barista" },
    { key: "mo", name: "Mo Hassan", role: "employee", title: "Cashier" },
    { key: "sam2", name: "Sam Okafor", role: "employee", title: "Cashier" },
  ]);
  // Company B: must never leak into A's answers.
  const b = await makeCompany("Other Cafe", [
    { key: "olive", name: "Olive Outsider", role: "owner" },
    { key: "barry", name: "Barry Boss", role: "manager" },
  ]);

  const mk = (key: string, startDay: number, startH: number, endDay: number, endH: number, title: string, status: "draft" | "published") =>
    testDb.insert(schema.shifts).values({
      companyId: a.companyId,
      employeeId: a.ids[key]!,
      title,
      startTime: at(startDay, startH),
      endTime: at(endDay, endH),
      status,
      publishedAt: status === "published" ? new Date() : null,
    });
  await mk("sam", 1, 8, 1, 16, "Opening", "published");
  await mk("jordan", 1, 16, 1, 23, "Closing", "published");
  await mk("mo", 1, 9, 1, 17, "Register DRAFTONLY", "draft"); // draft: employees must never see
  await mk("sam", 2, 8, 2, 16, "Opening", "published");
  await mk("priya", 1, 12, 1, 20, "Floor", "published");
  await testDb.insert(schema.shifts).values({
    companyId: b.companyId,
    employeeId: b.ids.barry!,
    title: "OTHERCO shift",
    startTime: at(1, 8),
    endTime: at(1, 16),
    status: "published",
  });

  // Availability
  const allDays = (key: string, start: string, end: string, off: number[] = []) =>
    testDb.insert(schema.availabilityWindows).values(
      Array.from({ length: 7 }, (_, d) => ({
        userId: a.ids[key]!,
        dayOfWeek: d,
        isAvailable: !off.includes(d),
        startTime: start,
        endTime: end,
      })),
    );
  await allDays("sam", "08:00", "16:00", [6]);
  await allDays("jordan", "12:00", "23:00");

  // Time off (with a sensitive note), approved + pending
  await testDb.insert(schema.timeOffRequests).values([
    { companyId: a.companyId, employeeId: a.ids.mo!, type: "sick", startDate: dateOnly(3), endDate: dateOnly(4), note: CANARIES.timeOffNote, status: "approved" },
    { companyId: a.companyId, employeeId: a.ids.sam!, type: "vacation", startDate: dateOnly(5), endDate: dateOnly(6), note: CANARIES.timeOffNote, status: "pending" },
  ]);

  // Time entries (with a reviewer note)
  const [shiftRow] = await testDb
    .select()
    .from(schema.shifts)
    .where(eq(schema.shifts.employeeId, a.ids.sam!))
    .limit(1);
  await testDb.insert(schema.timeEntries).values({
    companyId: a.companyId,
    employeeId: a.ids.sam!,
    shiftId: shiftRow!.id,
    punchedInAt: at(0, 8),
    punchedOutAt: at(0, 12),
    clockInAt: at(0, 8),
    clockOutAt: at(0, 12),
    status: "pending",
    reviewNote: CANARIES.reviewNote,
  });

  // A private conversation: must never surface anywhere.
  const [conv] = await testDb.insert(schema.conversations).values({ companyId: a.companyId, pairKey: `${a.ids.sam}:${a.ids.priya}` }).returning();
  await testDb.insert(schema.conversationParticipants).values([
    { conversationId: conv!.id, userId: a.ids.sam! },
    { conversationId: conv!.id, userId: a.ids.priya! },
  ]);
  await testDb.insert(schema.directMessages).values({
    conversationId: conv!.id,
    senderId: a.ids.sam!,
    body: `${CANARIES.dm} I am quitting`,
  });

  return { a, b };
}

export type Seeded = Awaited<ReturnType<typeof seed>>;

let seeded: Promise<Seeded> | null = null;
/** One shared dataset per test process (all test files share the in-memory DB). */
export const seedOnce = () => (seeded ??= seed());

export const principalFor = (seeded: Seeded, key: string, role: "owner" | "manager" | "employee", name: string) => ({
  userId: seeded.a.ids[key]!,
  companyId: seeded.a.companyId,
  role,
  fullName: name,
});
