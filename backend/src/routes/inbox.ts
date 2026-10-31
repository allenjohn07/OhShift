import { Hono } from "hono";
import { requireCompanyMember, requireUser } from "../lib/auth-guard";
import { countUnreadAnnouncements } from "./announcements";
import { totalUnreadMessages } from "./messages";

export const inboxRoutes = new Hono().get("/unread", async (c) => {
  const user = await requireUser(c);
  const companyId = requireCompanyMember(user);

  const [announcements, messages] = await Promise.all([
    countUnreadAnnouncements(companyId, user.id),
    totalUnreadMessages(user.id),
  ]);

  return c.json({
    announcements,
    messages,
    total: announcements + messages,
  });
});
