import { Elysia } from "elysia";
import { ApiError, requireUser } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";

const BODY_MAX = 2000;
const MESSAGE_LIMIT = 100;

function requireCompanyMember(user: { companyId: string | null }) {
  if (!user.companyId) {
    throw new ApiError("No company associated with user", 400);
  }
  return user.companyId;
}

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

async function assertParticipant(
  conversationId: string,
  userId: string,
  companyId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
    include: {
      participants: true,
    },
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

export const messagesRoutes = new Elysia({ prefix: "/messages" })
  .get("/directory", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const members = await prisma.user.findMany({
        where: { companyId, id: { not: user.id } },
        select: {
          id: true,
          fullName: true,
          role: true,
          avatarUrl: true,
        },
        orderBy: { fullName: "asc" },
      });

      return { members: members.map(serializeMember) };
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
      requireCompanyMember(user);

      const participations = await prisma.conversationParticipant.findMany({
        where: { userId: user.id },
        select: {
          conversationId: true,
          lastReadAt: true,
        },
      });

      let count = 0;
      for (const p of participations) {
        count += await prisma.directMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: user.id },
            ...(p.lastReadAt
              ? { createdAt: { gt: p.lastReadAt } }
              : {}),
          },
        });
      }

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
  .get("/conversations", async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const conversations = await prisma.conversation.findMany({
        where: {
          companyId,
          participants: { some: { userId: user.id } },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                  avatarUrl: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      const result = await Promise.all(
        conversations.map(async (c) => {
          const me = c.participants.find((p) => p.userId === user.id)!;
          const other = c.participants.find((p) => p.userId !== user.id)!;
          const last = c.messages[0] ?? null;
          const unread = await prisma.directMessage.count({
            where: {
              conversationId: c.id,
              senderId: { not: user.id },
              ...(me.lastReadAt
                ? { createdAt: { gt: me.lastReadAt } }
                : {}),
            },
          });

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
            unread_count: unread,
          };
        }),
      );

      return { conversations: result };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/conversations", async ({ headers, set, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);
      const payload = body as { recipient_id?: string };
      const recipientId = String(payload.recipient_id ?? "").trim();

      if (!recipientId) {
        set.status = 400;
        return { error: "recipient_id is required" };
      }
      if (recipientId === user.id) {
        set.status = 400;
        return { error: "Cannot message yourself" };
      }

      const recipient = await prisma.user.findFirst({
        where: { id: recipientId, companyId },
        select: {
          id: true,
          fullName: true,
          role: true,
          avatarUrl: true,
        },
      });
      if (!recipient) {
        set.status = 400;
        return { error: "Recipient not found in your company" };
      }

      const pairKey = pairKeyFor(user.id, recipient.id);
      const conversationInclude = {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
        },
      };

      let conversation = await prisma.conversation.findUnique({
        where: {
          companyId_pairKey: { companyId, pairKey },
        },
        include: conversationInclude,
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            companyId,
            pairKey,
            participants: {
              create: [{ userId: user.id }, { userId: recipient.id }],
            },
          },
          include: conversationInclude,
        });
      }

      const other = conversation.participants.find(
        (p) => p.userId !== user.id,
      )!;
      const me = conversation.participants.find((p) => p.userId === user.id)!;
      const last = conversation.messages[0] ?? null;
      const unread = await prisma.directMessage.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: user.id },
          ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      });

      return {
        conversation: {
          id: conversation.id,
          updated_at: conversation.updatedAt.toISOString(),
          other: serializeMember(other.user),
          last_message: last
            ? {
                id: last.id,
                body: last.body,
                sender_id: last.senderId,
                created_at: last.createdAt.toISOString(),
              }
            : null,
          unread_count: unread,
        },
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
  .get("/conversations/:id", async ({ headers, set, params }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);
      await assertParticipant(params.id, user.id, companyId);

      const messages = await prisma.directMessage.findMany({
        where: { conversationId: params.id },
        orderBy: { createdAt: "asc" },
        take: MESSAGE_LIMIT,
      });

      return { messages: messages.map(serializeMessage) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/conversations/:id", async ({ headers, set, params, body }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);
      await assertParticipant(params.id, user.id, companyId);

      const payload = body as { body?: string };
      const text = String(payload.body ?? "").trim();
      if (!text) {
        set.status = 400;
        return { error: "Message body is required" };
      }
      if (text.length > BODY_MAX) {
        set.status = 400;
        return { error: `Message must be ${BODY_MAX} characters or fewer` };
      }

      const now = new Date();
      const [message] = await prisma.$transaction([
        prisma.directMessage.create({
          data: {
            conversationId: params.id,
            senderId: user.id,
            body: text,
          },
        }),
        prisma.conversation.update({
          where: { id: params.id },
          data: { updatedAt: now },
        }),
        prisma.conversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId: params.id,
              userId: user.id,
            },
          },
          data: { lastReadAt: now },
        }),
      ]);

      return { message: serializeMessage(message) };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post("/conversations/:id/read", async ({ headers, set, params }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);
      await assertParticipant(params.id, user.id, companyId);

      await prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: params.id,
            userId: user.id,
          },
        },
        data: { lastReadAt: new Date() },
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
  });
