import * as v from "../lib/validation";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import {
  conversationParticipants,
  conversations,
  directMessages,
  users,
} from "../db/schema";
import { ApiError, jsonBody, requireCompanyMember, requireUser } from "../lib/auth-guard";

const BODY_MAX = 2000;
const MESSAGE_LIMIT = 100;

function pairKeyFor(a: string, b: string) {
  return [a, b].sort().join(":");
}

function serializeMember(u: {
  id: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
}) {
  return {
    id: u.id,
    full_name: u.fullName,
    role: u.role,
    avatar_url: u.avatarUrl,
  };
}

function serializeMessage(row: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    sender_id: row.senderId,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

const memberColumns = {
  id: true,
  fullName: true,
  role: true,
  avatarUrl: true,
} as const;

const conversationWith = {
  participants: {
    with: { user: { columns: memberColumns } },
  },
  messages: {
    orderBy: desc(directMessages.createdAt),
    limit: 1,
  },
} as const;

/**
 * Unread DMs for a user, grouped by conversation — one query instead of a
 * count per conversation.
 */
export async function unreadMessageCounts(userId: string) {
  const rows = await db
    .select({
      conversationId: directMessages.conversationId,
      count: sql<number>`count(*)`,
    })
    .from(directMessages)
    .innerJoin(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, directMessages.conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .where(
      and(
        ne(directMessages.senderId, userId),
        or(
          isNull(conversationParticipants.lastReadAt),
          gt(directMessages.createdAt, conversationParticipants.lastReadAt),
        ),
      ),
    )
    .groupBy(directMessages.conversationId);

  return new Map(rows.map((r) => [r.conversationId, Number(r.count)]));
}

export async function totalUnreadMessages(userId: string) {
  let total = 0;
  for (const count of (await unreadMessageCounts(userId)).values()) {
    total += count;
  }
  return total;
}

type ConversationRow = NonNullable<
  Awaited<ReturnType<typeof findConversation>>
>;

function findConversation(id: string) {
  return db.query.conversations.findFirst({
    where: eq(conversations.id, id),
    with: conversationWith,
  });
}

function serializeConversation(
  c: ConversationRow,
  userId: string,
  unread: Map<string, number>,
) {
  const other = c.participants.find((p) => p.userId !== userId)!;
  const last = c.messages[0] ?? null;
  return {
    id: c.id,
    updated_at: c.updatedAt.toISOString(),
    other: serializeMember(other.user),
    last_message: last
      ? {
          id: last.id,
          body: last.body,
          sender_id: last.senderId,
          created_at: last.createdAt.toISOString(),
        }
      : null,
    unread_count: unread.get(c.id) ?? 0,
  };
}

async function assertParticipant(
  conversationId: string,
  userId: string,
  companyId: string,
) {
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.companyId, companyId),
    ),
    with: { participants: true },
  });
  if (!conversation) {
    throw new ApiError("Conversation not found", 404);
  }
  const me = conversation.participants.find((p) => p.userId === userId);
  if (!me) {
    throw new ApiError("Forbidden", 403);
  }
  return { conversation, me };
}

function markReadStatement(conversationId: string, userId: string, at: Date) {
  return db
    .update(conversationParticipants)
    .set({ lastReadAt: at })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
}

type StartConversationBody = { recipient_id: string };

type SendMessageBody = { body: string };

export const messagesRoutes = new Hono()
  .get("/directory", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const members = await db.query.users.findMany({
      where: and(eq(users.companyId, companyId), ne(users.id, user.id)),
      columns: memberColumns,
      orderBy: asc(users.fullName),
    });

    return c.json({ members: members.map(serializeMember) });
  })
  .get("/unread-count", async (c) => {
    const user = await requireUser(c);
    requireCompanyMember(user);

    return c.json({ count: await totalUnreadMessages(user.id) });
  })
  .get("/conversations", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);

    const [rows, unread] = await Promise.all([
      db.query.conversations.findMany({
        where: and(
          eq(conversations.companyId, companyId),
          inArray(
            conversations.id,
            db
              .select({ id: conversationParticipants.conversationId })
              .from(conversationParticipants)
              .where(eq(conversationParticipants.userId, user.id)),
          ),
        ),
        orderBy: desc(conversations.updatedAt),
        with: conversationWith,
      }),
      unreadMessageCounts(user.id),
    ]);

    return c.json({
      conversations: rows.map((row) => serializeConversation(row, user.id, unread)),
    });
  })
  .post("/conversations", jsonBody<StartConversationBody>({ recipient_id: v.text(100, 1) }), async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);
    const payload = c.req.valid("json");
    const recipientId = String(payload.recipient_id ?? "").trim();

    if (!recipientId) {
      return c.json({ error: "recipient_id is required" }, 400);
    }
    if (recipientId === user.id) {
      return c.json({ error: "Cannot message yourself" }, 400);
    }

    const recipient = await db.query.users.findFirst({
      where: and(eq(users.id, recipientId), eq(users.companyId, companyId)),
      columns: { id: true },
    });
    if (!recipient) {
      return c.json({ error: "Recipient not found in your company" }, 400);
    }

    const pairKey = pairKeyFor(user.id, recipient.id);
    let existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.companyId, companyId),
        eq(conversations.pairKey, pairKey),
      ),
      columns: { id: true },
    });

    if (!existing) {
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(conversations).values({ id, companyId, pairKey }),
        db.insert(conversationParticipants).values([
          { conversationId: id, userId: user.id },
          { conversationId: id, userId: recipient.id },
        ]),
      ]);
      existing = { id };
    }

    const [conversation, unread] = await Promise.all([
      findConversation(existing.id),
      unreadMessageCounts(user.id),
    ]);

    return c.json({
      conversation: serializeConversation(conversation!, user.id, unread),
    });
  })
  .get("/conversations/:id", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);
    const conversationId = c.req.param("id");
    await assertParticipant(conversationId, user.id, companyId);

    const messages = await db.query.directMessages.findMany({
      where: eq(directMessages.conversationId, conversationId),
      orderBy: asc(directMessages.createdAt),
      limit: MESSAGE_LIMIT,
    });

    return c.json({ messages: messages.map(serializeMessage) });
  })
  .post("/conversations/:id", jsonBody<SendMessageBody>({ body: v.text(2000, 1) }), async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);
    const conversationId = c.req.param("id");
    await assertParticipant(conversationId, user.id, companyId);

    const payload = c.req.valid("json");
    const text = String(payload.body ?? "").trim();
    if (!text) {
      return c.json({ error: "Message body is required" }, 400);
    }
    if (text.length > BODY_MAX) {
      return c.json({ error: `Message must be ${BODY_MAX} characters or fewer` }, 400);
    }

    const now = new Date();
    const [[message]] = await db.batch([
      db
        .insert(directMessages)
        .values({
          conversationId,
          senderId: user.id,
          body: text,
          createdAt: now,
        })
        .returning(),
      db
        .update(conversations)
        .set({ updatedAt: now })
        .where(eq(conversations.id, conversationId)),
      markReadStatement(conversationId, user.id, now),
    ]);

    return c.json({ message: serializeMessage(message!) });
  })
  .post("/conversations/:id/read", async (c) => {
    const user = await requireUser(c);
    const companyId = requireCompanyMember(user);
    const conversationId = c.req.param("id");
    await assertParticipant(conversationId, user.id, companyId);

    await markReadStatement(conversationId, user.id, new Date());

    return c.json({ ok: true });
  });
