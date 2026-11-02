/**
 * One-off admin recovery: set a user's password directly in D1.
 *
 * Usage (from backend/):
 *   bun run set-password user@example.com NewPasswordHere            # local D1
 *   bun run set-password user@example.com NewPasswordHere --remote   # production D1
 */
import { hashPassword } from "../src/lib/password";

const email = process.argv[2]?.trim().toLowerCase();
const newPassword = process.argv[3];
const target = process.argv.includes("--remote") ? "--remote" : "--local";

if (!email || !newPassword) {
  console.error(
    "Usage: bun run set-password <email> <new-password> [--remote]",
  );
  process.exit(1);
}

if (newPassword.length < 12 || newPassword.length > 128) {
  console.error("Password must be between 12 and 128 characters.");
  process.exit(1);
}

const passwordHash = await hashPassword(newPassword);
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sql = `UPDATE users SET password_hash = ${quote(passwordHash)}, session_version = session_version + 1 WHERE email = ${quote(email)};`;

const proc = Bun.spawnSync(
  ["bunx", "wrangler", "d1", "execute", "ohshift", target, "--json", "--command", sql],
  { stdout: "pipe", stderr: "inherit" },
);
if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);

const [result] = JSON.parse(proc.stdout.toString()) as Array<{
  meta?: { changes?: number };
}>;
if (!result?.meta?.changes) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log(`Password updated for ${email} (${target.slice(2)} D1).`);
