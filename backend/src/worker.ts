import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { buildApp } from "./app";
import { runWithPrisma } from "./lib/prisma";

const app = buildApp({ adapter: CloudflareAdapter }).compile();

type WorkerEnv = Record<string, unknown>;

function applyEnv(env: WorkerEnv) {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    applyEnv(env);
    return runWithPrisma(() => Promise.resolve(app.fetch(request)));
  },
};
