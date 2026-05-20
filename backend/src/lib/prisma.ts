import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: ["error"],
  });
}

// Dev: new client each time this module loads (picks up log config; no stale singleton).
// Prod: one shared client for the process lifetime.
if (process.env.NODE_ENV === "production") {
  globalForPrisma.prisma ??= createPrismaClient();
}

export const prisma =
  process.env.NODE_ENV === "production"
    ? globalForPrisma.prisma!
    : createPrismaClient();
