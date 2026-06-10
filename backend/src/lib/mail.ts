import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

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

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth,
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
