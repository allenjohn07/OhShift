import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

const SMTP_TIMEOUT_MS = 15_000;

function useBrevo() {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

function brevoSenderEmail() {
  return (
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.SMTP_EMAIL?.trim() ||
    null
  );
}

function smtpCredentials() {
  const user = process.env.SMTP_EMAIL?.trim();
  const pass = process.env.SMTP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

function createSmtpTransporter(): Transporter | null {
  const auth = smtpCredentials();
  if (!auth) return null;

  // family: 4 avoids IPv6 ECONNREFUSED on some hosts. Note: Render free tier
  // blocks SMTP ports 25/465/587 entirely — use Brevo API in production.
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth,
    family: 4,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter === undefined) {
    transporter = createSmtpTransporter();
  }
  return transporter;
}

export function mailConfigured() {
  if (useBrevo()) return Boolean(brevoSenderEmail());
  return getTransporter() !== null;
}

export function mailErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof Error && "code" in err
      ? String((err as NodeJS.ErrnoException).code)
      : "";

  if (
    code === "ECONNREFUSED" &&
    (message.includes(":587") || message.includes(":465") || message.includes(":25"))
  ) {
    return "SMTP is blocked on Render free tier. Add BREVO_API_KEY on Render instead of Gmail SMTP.";
  }

  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    message.toLowerCase().includes("timeout")
  ) {
    return "Email server timed out. On Render free tier, use Brevo (BREVO_API_KEY) instead of SMTP.";
  }

  if (
    code === "EAUTH" ||
    message.includes("Invalid login") ||
    message.includes("authentication failed")
  ) {
    return "Email is misconfigured on the server (check Gmail app password or Brevo API key).";
  }

  return message || "Failed to send email.";
}

async function sendViaBrevo(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.BREVO_API_KEY!.trim();
  const senderEmail = brevoSenderEmail();
  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL or SMTP_EMAIL must be set with BREVO_API_KEY.");
  }

  const fromName = options.subject.includes("Invitation")
    ? "OhShift Invitations"
    : options.subject.includes("Shift")
      ? "OhShift Scheduling"
      : "OhShift Support";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: senderEmail },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Brevo API failed:", res.status, body);
    throw new Error(`Brevo send failed (${res.status}): ${body}`);
  }
}

export async function verifyMailConnection(): Promise<void> {
  if (useBrevo()) {
    const sender = brevoSenderEmail();
    if (!sender) {
      console.warn("Mail: BREVO_API_KEY set but no BREVO_SENDER_EMAIL / SMTP_EMAIL.");
      return;
    }
    console.log(`Mail: Brevo API configured (sender: ${sender}).`);
    return;
  }

  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Mail: not configured. Set BREVO_API_KEY on Render (SMTP blocked on free tier) or SMTP_EMAIL locally.",
    );
    return;
  }

  try {
    await transport.verify();
    console.log("Mail: Gmail SMTP connection verified.");
  } catch (err) {
    console.error("Mail: SMTP verification failed:", err);
    console.warn(
      "Mail: Render free tier blocks SMTP ports. Use Brevo — see backend/README.md.",
    );
  }
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (useBrevo()) {
    try {
      await sendViaBrevo(options);
    } catch (err) {
      console.error("sendMail failed (Brevo):", err);
      throw err;
    }
    return;
  }

  const transport = getTransporter();
  const fromEmail = process.env.SMTP_EMAIL?.trim();

  if (!transport || !fromEmail) {
    throw new Error(
      "Email not configured. Set BREVO_API_KEY on Render or SMTP_EMAIL locally.",
    );
  }

  try {
    await transport.sendMail({
      from: options.subject.includes("Invitation")
        ? `"OhShift Invitations" <${fromEmail}>`
        : options.subject.includes("Shift")
          ? `"OhShift Scheduling" <${fromEmail}>`
          : `"OhShift Support" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (err) {
    console.error("sendMail failed (SMTP):", err);
    throw err;
  }
}

/** Public app URL including GitHub Pages base path when configured. */
export function appUrl() {
  const raw = process.env.FRONTEND_URL || "http://localhost:3000";
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.replace(/\/$/, "");
    if (path && path !== "/") {
      return `${parsed.origin}${path}`;
    }
    const basePath = (process.env.APP_BASE_PATH || "").replace(/\/$/, "");
    if (basePath) {
      return `${parsed.origin}${basePath.startsWith("/") ? basePath : `/${basePath}`}`;
    }
    return parsed.origin;
  } catch {
    return raw.replace(/\/$/, "");
  }
}
