import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaAls = new AsyncLocalStorage<PrismaClient>();

// Use HTTP instead of WebSockets (required on Cloudflare Workers; also fine locally).
neonConfig.poolQueryViaFetch = true;

function isCloudflareWorker() {
  return (
    typeof (globalThis as { caches?: unknown }).caches !== "undefined" &&
    typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
      "undefined"
  );
}

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
  const requestScoped = prismaAls.getStore();
  if (requestScoped) return requestScoped;

  // Local Bun / non-Worker: reuse one client.
  if (!isCloudflareWorker()) {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }

  // Fallback if a Worker request somehow skips runWithPrisma.
  return createPrismaClient();
}

/**
 * Cloudflare Workers: create one PrismaClient per request and disconnect after.
 * Reusing a global client across requests causes WASM memory corruption
 * ("Invalid array buffer length") and hung requests.
 */
export async function runWithPrisma<T>(fn: () => Promise<T>): Promise<T> {
  if (!isCloudflareWorker()) {
    return fn();
  }

  const client = createPrismaClient();
  try {
    return await prismaAls.run(client, fn);
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

/** Lazy client so importing modules does not require DATABASE_URL at load time. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
