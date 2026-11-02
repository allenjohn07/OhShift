import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { emailJobs } from "../db/schema";
import { emailConfig, sendEmail } from "./email";
import { getDbUser } from "./session";

export async function deliverScheduleEmails() {
  // Leave the outbox untouched when credentials are missing.
  const config = emailConfig();
  const now = new Date(), leaseToken = crypto.randomUUID();
  await db.update(emailJobs).set({ status: "failed", leaseToken: null, leaseUntil: null })
    .where(and(eq(emailJobs.status, "sending"), sql`${emailJobs.attempts} >= 6 AND ${emailJobs.leaseUntil} <= ${now.getTime()}`));
  const jobs = await db.update(emailJobs).set({ status: "sending", attempts: sql`${emailJobs.attempts} + 1`, leaseToken, leaseUntil: new Date(now.getTime() + 600_000) })
    .where(sql`id IN (SELECT id FROM email_jobs WHERE attempts < 6 AND ((status = 'pending' AND available_at <= ${now.getTime()}) OR (status = 'sending' AND lease_until <= ${now.getTime()})) ORDER BY available_at LIMIT 10)`)
    .returning();
  for (const job of jobs) {
    const claim = and(eq(emailJobs.id, job.id), eq(emailJobs.leaseToken, leaseToken));
    try {
      const recipient = await getDbUser(job.employeeId);
      if (!recipient || recipient.companyId !== job.companyId) {
        await db.update(emailJobs).set({ status: "cancelled", leaseToken: null, leaseUntil: null }).where(claim);
        continue;
      }
      await sendEmail({ to: recipient.email, subject: "Your OhShift schedule is published", text: `Your schedule for the week of ${job.weekStart} is ready. Sign in to view your shifts:\n\n${config.appUrl}/login`, idempotencyKey: `schedule/${job.id}` });
      await db.update(emailJobs).set({ status: "sent", sentAt: new Date(), leaseToken: null, leaseUntil: null }).where(claim);
    } catch {
      await db.update(emailJobs).set({ status: job.attempts >= 6 ? "failed" : "pending", availableAt: new Date(Date.now() + 60_000 * 2 ** job.attempts), leaseToken: null, leaseUntil: null }).where(claim);
      console.error("Schedule email delivery failed", { jobId: job.id, attempt: job.attempts });
    }
  }
}
