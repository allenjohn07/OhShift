import { and, asc, inArray, isNotNull, isNull, like, lt } from "drizzle-orm";
import { db } from "../../db";
import {
  accountTokens,
  announcementEmbeddings,
  announcementReads,
  announcements,
  authRateBuckets,
  availabilityWindows,
  companies,
  conversationParticipants,
  conversations,
  directMessages,
  emailJobs,
  shiftLogs,
  shifts,
  timeEntries,
  timeOffRequests,
  users,
} from "../../db/schema";

const PER_RUN = 25;

/**
 * Deletes expired demo sandboxes, children first, in one D1 batch. Explicit
 * deletes (rather than relying on ON DELETE CASCADE) keep this correct whether
 * or not foreign keys are enforced. Query builders only: Drizzle's D1 batch
 * can't bind raw `db.run(sql)` statements that have parameters.
 * Returns how many sandboxes were removed.
 */
export async function deleteExpiredDemoSandboxes(now = new Date()) {
  const expired = await db.select({ id: companies.id }).from(companies)
    .where(and(isNotNull(companies.demoExpiresAt), lt(companies.demoExpiresAt, now)))
    .orderBy(asc(companies.demoExpiresAt))
    .limit(PER_RUN);
  if (!expired.length) return 0;

  const ids = expired.map(row => row.id);
  const members = db.select({ id: users.id }).from(users).where(inArray(users.companyId, ids));
  const sandboxConversations = db.select({ id: conversations.id }).from(conversations).where(inArray(conversations.companyId, ids));
  const sandboxAnnouncements = db.select({ id: announcements.id }).from(announcements).where(inArray(announcements.companyId, ids));

  await db.batch([
    db.delete(directMessages).where(inArray(directMessages.conversationId, sandboxConversations)),
    db.delete(conversationParticipants).where(inArray(conversationParticipants.conversationId, sandboxConversations)),
    db.delete(conversations).where(inArray(conversations.companyId, ids)),
    db.delete(announcementReads).where(inArray(announcementReads.announcementId, sandboxAnnouncements)),
    db.delete(announcementEmbeddings).where(inArray(announcementEmbeddings.companyId, ids)),
    db.delete(announcements).where(inArray(announcements.companyId, ids)),
    db.delete(timeEntries).where(inArray(timeEntries.companyId, ids)),
    db.delete(timeOffRequests).where(inArray(timeOffRequests.companyId, ids)),
    db.delete(emailJobs).where(inArray(emailJobs.companyId, ids)),
    db.delete(shiftLogs).where(inArray(shiftLogs.companyId, ids)),
    db.delete(shifts).where(inArray(shifts.companyId, ids)),
    db.delete(availabilityWindows).where(inArray(availabilityWindows.userId, members)),
    db.delete(accountTokens).where(inArray(accountTokens.userId, members)),
    db.delete(authRateBuckets).where(inArray(authRateBuckets.key, ids.map(id => `demo-ai:${id}`))),
    // Unlink members, drop the companies, then the (now company-less) demo users.
    db.update(users).set({ companyId: null }).where(inArray(users.companyId, ids)),
    db.delete(companies).where(inArray(companies.id, ids)),
    db.delete(users).where(and(isNull(users.companyId), like(users.email, "%.demo.invalid"))),
  ]);
  return ids.length;
}
