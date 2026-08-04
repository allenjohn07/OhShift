import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** Cryptographically secure temp password / invite code (8 hex chars). */
export function generateTempPassword() {
  return randomBytes(4).toString("hex").toUpperCase();
}
