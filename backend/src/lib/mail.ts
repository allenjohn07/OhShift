import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

const SMTP_TIMEOUT_MS = 15_000;

function smtpCredentials() {
  const user = process.env.SMTP_EMAIL?.trim();
  // Gmail app passwords are often copied with spaces — strip them.
  const pass = process.env.SMTP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

function createSmtpTransporter(): Transporter | null {
  const auth = smtpCredentials();
  if (!auth) return null;

  // Port 587 + STARTTLS is more reliable from cloud hosts (e.g. Render) than 465.
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth,
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
  return getTransporter() !== null;
}

export function mailErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof Error && "code" in err
      ? String((err as NodeJS.ErrnoException).code)
      : "";

  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    message.toLowerCase().includes("timeout")
  ) {
    return "Email server timed out. Try again in a moment — if this keeps happening, check SMTP settings on Render.";
  }

  if (
    code === "EAUTH" ||
    message.includes("Invalid login") ||
    message.includes("authentication failed")
  ) {
    return "Email is misconfigured on the server (check Gmail app password on Render).";
  }

  return message || "Failed to send email.";
}

export async function verifyMailConnection(): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.warn("Mail: SMTP_EMAIL / SMTP_PASSWORD not set — emails disabled.");
    return;
  }

  try {
    await transport.verify();
    console.log("Mail: SMTP connection verified.");
  } catch (err) {
    console.error("Mail: SMTP verification failed:", err);
  }
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const transport = getTransporter();
  const fromEmail = process.env.SMTP_EMAIL?.trim();

  if (!transport || !fromEmail) {
    throw new Error("SMTP_EMAIL or SMTP_PASSWORD is not configured on the server.");
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
    console.error("sendMail failed:", err);
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
