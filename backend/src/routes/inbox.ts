import { Elysia } from "elysia";
import { ApiError, requireUser } from "../lib/auth-guard";
import { prisma } from "../lib/prisma";

function requireCompanyMember(user: { companyId: string | null }) {
  if (!user.companyId) {
    throw new ApiError("No company associated with user", 400);
  }
  return user.companyId;
}

export const inboxRoutes = new Elysia({ prefix: "/inbox" }).get(
  "/unread",
  async ({ headers, set }) => {
    try {
      const user = await requireUser(headers.authorization ?? null);
      const companyId = requireCompanyMember(user);

      const announcements = await prisma.announcement.count({
        where: {
          companyId,
          authorId: { not: user.id },
          reads: { none: { userId: user.id } },
        },
      });

      const participations = await prisma.conversationParticipant.findMany({
        where: { userId: user.id },
        select: {
          conversationId: true,
          lastReadAt: true,
        },
      });

      let messages = 0;
      for (const p of participations) {
        messages += await prisma.directMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: user.id },
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        });
      }

      return {
        announcements,
        messages,
        total: announcements + messages,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        set.status = err.status;
        return { error: err.message };
      }
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  },
);
