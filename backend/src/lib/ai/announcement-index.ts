import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "../../db";
import { announcementEmbeddings, announcements } from "../../db/schema";
import { EMBEDDING_MODEL, runEmbedding } from "../workers-ai";
import { encodeVector } from "./vectors";

/** What gets embedded: the title carries most of the meaning, so it leads. */
const MAX_CHARS = 1500;
export const embeddingText = (a: { title: string; body: string }) =>
  `${a.title}\n${a.body}`.slice(0, MAX_CHARS);

/**
 * (Re)build one announcement's embedding. Called after create/edit; failures are
 * swallowed (the assistant falls back to keyword search and re-indexes lazily),
 * so a Workers AI hiccup can never break posting an announcement.
 */
export async function indexAnnouncement(a: {
  id: string;
  companyId: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const [vector] = await runEmbedding([embeddingText(a)]);
    if (!vector) return;
    const row = {
      announcementId: a.id,
      companyId: a.companyId,
      model: EMBEDDING_MODEL,
      vector: encodeVector(vector),
      updatedAt: new Date(),
    };
    await db
      .insert(announcementEmbeddings)
      .values(row)
      .onConflictDoUpdate({
        target: announcementEmbeddings.announcementId,
        set: { model: row.model, vector: row.vector, updatedAt: row.updatedAt },
      });
  } catch (err) {
    console.error("announcement indexing failed", err);
  }
}

/**
 * Index announcements that have no embedding yet (posted before this feature, or
 * whose indexing failed) or were embedded with an older model. Capped per call so
 * a big backlog is worked off gradually across questions.
 */
export async function ensureIndexed(companyId: string, limit = 20): Promise<void> {
  const missing = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
    })
    .from(announcements)
    .leftJoin(
      announcementEmbeddings,
      eq(announcementEmbeddings.announcementId, announcements.id),
    )
    .where(
      and(
        eq(announcements.companyId, companyId),
        or(
          isNull(announcementEmbeddings.announcementId),
          ne(announcementEmbeddings.model, EMBEDDING_MODEL),
        ),
      ),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(limit);
  if (missing.length === 0) return;

  try {
    const vectors = await runEmbedding(missing.map(embeddingText));
    const now = new Date();
    for (const [i, a] of missing.entries()) {
      const vector = vectors[i];
      if (!vector) continue;
      const encoded = encodeVector(vector);
      await db
        .insert(announcementEmbeddings)
        .values({ announcementId: a.id, companyId, model: EMBEDDING_MODEL, vector: encoded, updatedAt: now })
        .onConflictDoUpdate({
          target: announcementEmbeddings.announcementId,
          set: { model: EMBEDDING_MODEL, vector: encoded, updatedAt: now },
        });
    }
  } catch (err) {
    console.error("announcement backfill failed", err);
  }
}
