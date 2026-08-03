import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { buildApp } from "./app";
import { runWithPrisma } from "./lib/prisma";
import {
  runWithWorkersAi,
  type WorkersAiBinding,
} from "./lib/workers-ai";

const app = buildApp({ adapter: CloudflareAdapter }).compile();

type WorkerEnv = Record<string, unknown> & {
  AI?: WorkersAiBinding;
};

function applyEnv(env: WorkerEnv) {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const worker = {
  async fetch(request: Request, env: WorkerEnv) {
    applyEnv(env);
    return runWithPrisma(() =>
      runWithWorkersAi(env.AI, () => Promise.resolve(app.fetch(request))),
    );
  },
};

export default worker;
