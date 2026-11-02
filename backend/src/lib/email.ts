import { env } from "cloudflare:workers";

type MailConfig = { RESEND_API_KEY?: string; EMAIL_FROM?: string; APP_URL?: string };
export function emailConfig() {
  const config = env as unknown as MailConfig;
  if (!config.RESEND_API_KEY || !config.EMAIL_FROM || !config.APP_URL) {
    throw new Error("Email is not configured");
  }
  const origin = new URL(config.APP_URL);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
    throw new Error("APP_URL must use HTTPS");
  }
  return { key: config.RESEND_API_KEY, from: config.EMAIL_FROM, appUrl: origin.origin };
}
/** Small transport boundary so tests never call the provider. */
export const emailTransport = { fetch: (input: string, init: RequestInit): Promise<Response> => fetch(input, init) };
export type TransactionalEmail = { to: string; subject: string; text: string; idempotencyKey: string };
export async function sendEmail(mail: TransactionalEmail) {
  const config = emailConfig();
  // Keep provider bodies out of errors: they may contain addresses or tokens.
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await emailTransport.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": mail.idempotencyKey },
        body: JSON.stringify({ from: config.from, to: [mail.to], subject: mail.subject, text: mail.text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      if (attempt === 2) throw new Error("Email provider unavailable");
      continue;
    }
    if (response.ok) return;
    if (response.status !== 429 && response.status < 500) throw new Error("Email provider rejected delivery");
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error("Email provider unavailable");
}
