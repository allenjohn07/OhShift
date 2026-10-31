import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "drizzle-kit";

const LOCAL_D1_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

/** Most recently used local D1 file (created by `wrangler dev` / migrations). */
function localD1File(): string | undefined {
  try {
    return readdirSync(LOCAL_D1_DIR)
      .filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
      .map((f) => join(LOCAL_D1_DIR, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  } catch {
    return undefined;
  }
}

const url = localD1File();

// Generates SQL migrations into ./drizzle; apply them with wrangler
// (bun run db:migrate:local / db:migrate:remote). `db:studio` browses the local D1.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  ...(url ? { dbCredentials: { url: `file:${url}` } } : {}),
});
