import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { accountTokens, users } from "../db/schema";
import { ApiError } from "./auth-guard";
import { emailConfig, sendEmail } from "./email";
import { hashPassword } from "./password";

export async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export async function sendAccountLink(user: { id: string; email: string; fullName: string; sessionVersion: number }, purpose: "reset" | "invite", companyName?: string) {
  const config = emailConfig();
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  const id = crypto.randomUUID();
  const tokenHash = await digest(raw);
  const expiresAt = new Date(Date.now() + (purpose === "reset" ? 30 * 60_000 : 48 * 3_600_000));
  await db.insert(accountTokens).values({ id, userId: user.id, tokenHash, purpose, sessionVersion: user.sessionVersion, expiresAt });
  // A fragment keeps the token out of HTTP request URLs, logs and referrers.
  const link = `${config.appUrl}/set-password#${raw}`;
  try {
    await sendEmail({
      to: user.email,
      subject: purpose === "reset" ? "Reset your OhShift password" : "You're invited to OhShift",
      text: purpose === "reset"
        ? `Use this link to reset your OhShift password:\n\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email. Your password has not changed.`
        : `${user.fullName}, you have been invited to ${companyName ?? "your team"} on OhShift. Set your password:\n\n${link}\n\nThis link expires in 48 hours and can be used once.`,
      idempotencyKey: `account-link/${id}`,
    });
  } catch {
    await db.delete(accountTokens).where(eq(accountTokens.id, id));
    throw new Error("Could not send account email");
  }
}
export async function consumeAccountToken(raw: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(raw)) throw new ApiError("This link is invalid or expired. Request a new one.", 400);
  const tokenHash = await digest(raw);
  const row = await db.query.accountTokens.findFirst({ where: and(eq(accountTokens.tokenHash, tokenHash), isNull(accountTokens.consumedAt), gt(accountTokens.expiresAt, new Date())) });
  if (!row) throw new ApiError("This link is invalid or expired. Request a new one.", 400);
  const passwordHash = await hashPassword(password);
  const now = new Date();
  // Check freshness inside the write, so concurrent uses cannot both succeed.
  const [updated] = await db.batch([
    db.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, row.userId), eq(users.sessionVersion, row.sessionVersion), sql`EXISTS (SELECT 1 FROM account_tokens WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > ${now.getTime()})`))
      .returning({ id: users.id }),
    db.update(accountTokens).set({ consumedAt: now }).where(eq(accountTokens.id, row.id)),
  ]);
  if (!updated.length) throw new ApiError("This link is invalid or expired. Request a new one.", 400);
}
