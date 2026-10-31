import { and, desc, eq, ne, notExists, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { announcementReads, announcements } from "../db/schema";
import {
  isManagerRole,
  readJson,
  requireCompanyMember,
  requireManager,
  requireUser,
} from "../lib/auth-guard";

const TITLE_MAX = 120;
const BODY_MAX = 4000;
const LIST_LIMIT = 50;
// D1 binds at most 100 params per statement; read rows use 4 each.
const READ_INSERT_CHUNK = 20;

function serializeAnnouncement(
  row: {
    id: string;
    companyId: string;
    authorId: string;
    title: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    author?: { fullName: string; avatarUrl: string | null } | null;
    reads?: { id: string }[];
  },
  currentUserId: string,
) {
  const isAuthor = row.authorId === currentUserId;
  const isRead = isAuthor || (row.reads?.length ?? 0) > 0;

  return {
    id: row.id,
    company_id: row.companyId,
    author_id: row.authorId,
    title: row.title,
    body: row.body,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    is_read: isRead,
    author: row.author
      ? {
          full_name: row.author.fullName,
          avatar_url: row.author.avatarUrl,
        }
      : undefined,
  };
}

function announcementWith(userId: string) {
  return {
    author: { columns: { fullName: true, avatarUrl: true } },
    reads: {
      where: eq(announcementReads.userId, userId),
      columns: { id: true },
      limit: 1,
    },
  } as const;
}

function unreadWhere(companyId: string, userId: string) {
  return and(
    eq(announcements.companyId, companyId),
    ne(announcements.authorId, userId),
    notExists(
      db
        .select({ one: sql`1` })
        .from(announcementReads)
        .where(
          and(
            eq(announcementReads.announcementId, announcements.id),
            eq(announcementReads.userId, userId),
          ),
        ),
    ),
  );
}

/** Unread announcements (not authored by the user) — shared with /inbox. */
export function countUnreadAnnouncements(companyId: string, userId: string) {
  return db.$count(announcements, unreadWhere(companyId, userId));
}

function validate(title: string, text: string): string | null {
  if (!title) return "Title is required";
  if (title.length > TITLE_MAX) {
    return `Title must be ${TITLE_MAX} characters or fewer`;
  }
  if (!text) return "Body is required";
  if (text.length > BODY_MAX) {
    return `Body must be ${BODY_MAX} characters or fewer`;
  }
  return null;
}

async function loadAnnouncement(id: string, userId: string) {
  const row = await db.query.announcements.findFirst({
    where: eq(announcements.id, id),
    with: announcementWith(userId),
  });
  return serializeAnnouncement(row!, userId);
}

async function findCompanyAnnouncement(id: string, companyId: string) {
  return db.query.announcements.findFirst({
    where: and(eq(announcements.id, id), eq(announcements.companyId, companyId)),
  });
}

export const announcementsRoutes = new Hono()
  .get("/", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const rows = await db.query.announcements.findMany({
      where: eq(announcements.companyId, companyId),
      orderBy: desc(announcements.createdAt),
      limit: LIST_LIMIT,
      with: announcementWith(user.id),
    });

    return c.json({
      announcements: rows.map((row) => serializeAnnouncement(row, user.id)),
    });
  })
  .get("/unread-count", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const count = await countUnreadAnnouncements(companyId, user.id);
    return c.json({ count });
  })
  .post("/", async (c) => {
    const user = await requireManager(c);
    const payload = await readJson<{ title: string; body: string }>(c);

    const title = String(payload.title ?? "").trim();
    const text = String(payload.body ?? "").trim();
    const error = validate(title, text);
    if (error) {
      return c.json({ error }, 400);
    }

    const [row] = await db
      .insert(announcements)
      .values({
        companyId: user.companyId,
        authorId: user.id,
        title,
        body: text,
      })
      .returning({ id: announcements.id });

    return c.json({ announcement: await loadAnnouncement(row!.id, user.id) });
  })
  .post("/read-all", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const unread = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(unreadWhere(companyId, user.id));

    const inserts = [];
    for (let i = 0; i < unread.length; i += READ_INSERT_CHUNK) {
      inserts.push(
        db
          .insert(announcementReads)
          .values(
            unread.slice(i, i + READ_INSERT_CHUNK).map((a) => ({
              announcementId: a.id,
              userId: user.id,
            })),
          )
          .onConflictDoNothing(),
      );
    }
    const [first, ...rest] = inserts;
    if (first) {
      await db.batch([first, ...rest]);
    }

    return c.json({ marked: unread.length });
  })
  .post("/:id/read", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const announcement = await findCompanyAnnouncement(c.req.param("id"), companyId);
    if (!announcement) {
      return c.json({ error: "Announcement not found" }, 404);
    }

    await db
      .insert(announcementReads)
      .values({ announcementId: announcement.id, userId: user.id })
      .onConflictDoUpdate({
        target: [announcementReads.announcementId, announcementReads.userId],
        set: { readAt: new Date() },
      });

    return c.json({ ok: true });
  })
  .patch("/:id", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);
    const payload = await readJson<{ title: string; body: string }>(c);

    const existing = await findCompanyAnnouncement(c.req.param("id"), companyId);
    if (!existing) {
      return c.json({ error: "Announcement not found" }, 404);
    }
    if (existing.authorId !== user.id) {
      return c.json({ error: "Only the author can edit this announcement" }, 403);
    }

    const title =
      payload.title !== undefined ? String(payload.title).trim() : existing.title;
    const text =
      payload.body !== undefined ? String(payload.body).trim() : existing.body;
    const error = validate(title, text);
    if (error) {
      return c.json({ error }, 400);
    }

    await db
      .update(announcements)
      .set({ title, body: text })
      .where(eq(announcements.id, existing.id));

    return c.json({ announcement: await loadAnnouncement(existing.id, user.id) });
  })
  .delete("/:id", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const existing = await findCompanyAnnouncement(c.req.param("id"), companyId);
    if (!existing) {
      return c.json({ error: "Announcement not found" }, 404);
    }

    const canDelete = existing.authorId === user.id || isManagerRole(user.role);
    if (!canDelete) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db.delete(announcements).where(eq(announcements.id, existing.id));
    return c.json({ ok: true });
  });
