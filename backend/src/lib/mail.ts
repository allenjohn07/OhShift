import nodemailer from "nodemailer";

const transporter =
  process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      })
    : null;

export function mailConfigured() {
  return transporter !== null;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!transporter || !process.env.SMTP_EMAIL) {
    throw new Error("SMTP_EMAIL or SMTP_PASSWORD is not configured on the server.");
  }

  await transporter.sendMail({
    from: options.subject.includes("Invitation")
      ? `"OhShift Invitations" <${process.env.SMTP_EMAIL}>`
      : options.subject.includes("Shift")
        ? `"OhShift Scheduling" <${process.env.SMTP_EMAIL}>`
        : `"OhShift Support" <${process.env.SMTP_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export function appUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
}
