/**
 * One-off admin recovery: set a user's password directly in the database.
 *
 * Usage (from backend/):
 *   bun run scripts/set-password.ts user@example.com NewPasswordHere
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const email = process.argv[2]?.trim().toLowerCase();
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error("Usage: bun run scripts/set-password.ts <email> <new-password>");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`Password updated for ${email} (${user.fullName}, ${user.role}).`);
} finally {
  await prisma.$disconnect();
}
