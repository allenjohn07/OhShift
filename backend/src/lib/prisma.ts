import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use HTTP instead of WebSockets (required on Cloudflare Workers; also fine locally).
neonConfig.poolQueryViaFetch = true;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // PrismaNeon expects PoolConfig, not a Pool instance.
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }
  return createPrismaClient();
}

/** Lazy client so importing modules does not require DATABASE_URL at load time. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
