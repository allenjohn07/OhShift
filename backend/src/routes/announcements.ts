import { Elysia } from "elysia";
import {
  ApiError,
  isManagerRole,
  requireManager,
  requireUser,
} from "../lib/auth-guard";
import { prisma } from "../lib/prisma";

const TITLE_MAX = 120;
const BODY_MAX = 4000;
const LIST_LIMIT = 50;

function requireCompanyMember(user: { companyId: string | null }) {
  if (!user.companyId) {
    throw new ApiError("No company associated with user", 400);
  }
  return user.companyId;
}

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

export const announcementsRoutes = new Elysia({ prefix: "/announcements" })
  .get("/", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const rows = await prisma.announcement.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        include: {
          author: { select: { fullName: true, avatarUrl: true } },
          reads: {
            where: { userId: user.id },
            select: { id: true },
            take: 1,
          },
        },
      });

      return {
        announcements: rows.map((row) =>
          serializeAnnouncement(row, user.id),
        ),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .get("/unread-count", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const count = await prisma.announcement.count({
        where: {
          companyId,
          authorId: { not: user.id },
          reads: { none: { userId: user.id } },
        },
      });

      return { count };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/", async ({ headers, set, body }) => {
    try {
      const user = await requireManager(headers.authorization ?? null);
      const payload = body as { title?: string; body?: string };

      const title = String(payload.title ?? "").trim();
      const text = String(payload.body ?? "").trim();

      if (!title) {
        set.status = 400;
        return { error: "Title is required" };
      }
      if (title.length > TITLE_MAX) {
        set.status = 400;
        return { error: `Title must be ${TITLE_MAX} characters or fewer` };
      }
      if (!text) {
        set.status = 400;
        return { error: "Body is required" };
      }
      if (text.length > BODY_MAX) {
        set.status = 400;
        return { error: `Body must be ${BODY_MAX} characters or fewer` };
      }

      const row = await prisma.announcement.create({
        data: {
          companyId: user.companyId!,
          authorId: user.id,
          title,
          body: text,
        },
        include: {
          author: { select: { fullName: true, avatarUrl: true } },
          reads: {
            where: { userId: user.id },
            select: { id: true },
            take: 1,
          },
        },
      });

      return { announcement: serializeAnnouncement(row, user.id) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/read-all", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const unread = await prisma.announcement.findMany({
        where: {
          companyId,
          authorId: { not: user.id },
          reads: { none: { userId: user.id } },
        },
        select: { id: true },
      });

      if (unread.length > 0) {
        await prisma.announcementRead.createMany({
          data: unread.map((a) => ({
            announcementId: a.id,
            userId: user.id,
          })),
          skipDuplicates: true,
        });
      }

      return { marked: unread.length };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/:id/read", async ({ headers, set, params }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const announcement = await prisma.announcement.findFirst({
        where: { id: params.id, companyId },
      });
      if (!announcement) {
        set.status = 404;
        return { error: "Announcement not found" };
      }

      await prisma.announcementRead.upsert({
        where: {
          announcementId_userId: {
            announcementId: announcement.id,
            userId: user.id,
          },
        },
        create: {
          announcementId: announcement.id,
          userId: user.id,
        },
        update: { readAt: new Date() },
      });

      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .patch("/:id", async ({ headers, set, params, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);
      const payload = body as { title?: string; body?: string };

      const existing = await prisma.announcement.findFirst({
        where: { id: params.id, companyId },
      });
      if (!existing) {
        set.status = 404;
        return { error: "Announcement not found" };
      }
      if (existing.authorId !== user.id) {
        set.status = 403;
        return { error: "Only the author can edit this announcement" };
      }

      const title =
        payload.title !== undefined
          ? String(payload.title).trim()
          : existing.title;
      const text =
        payload.body !== undefined
          ? String(payload.body).trim()
          : existing.body;

      if (!title) {
        set.status = 400;
        return { error: "Title is required" };
      }
      if (title.length > TITLE_MAX) {
        set.status = 400;
        return { error: `Title must be ${TITLE_MAX} characters or fewer` };
      }
      if (!text) {
        set.status = 400;
        return { error: "Body is required" };
      }
      if (text.length > BODY_MAX) {
        set.status = 400;
        return { error: `Body must be ${BODY_MAX} characters or fewer` };
      }

      const row = await prisma.announcement.update({
        where: { id: existing.id },
        data: { title, body: text },
        include: {
          author: { select: { fullName: true, avatarUrl: true } },
          reads: {
            where: { userId: user.id },
            select: { id: true },
            take: 1,
          },
        },
      });

      return { announcement: serializeAnnouncement(row, user.id) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .delete("/:id", async ({ headers, set, params }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const existing = await prisma.announcement.findFirst({
        where: { id: params.id, companyId },
      });
      if (!existing) {
        set.status = 404;
        return { error: "Announcement not found" };
      }

      const canDelete =
        existing.authorId === user.id || isManagerRole(user.role);
      if (!canDelete) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      await prisma.announcement.delete({ where: { id: existing.id } });
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
