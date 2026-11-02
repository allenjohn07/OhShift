import { env } from "cloudflare:workers";
import { ApiError } from "../auth-guard";

/** The bit of the Workers Rate Limiting binding we use (typed here so the web app's type-check, which has no Workers types, can read this file). */
type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

/**
 * Per-user throttle for the (metered) AI endpoints, using the Workers Rate
 * Limiting binding configured in wrangler.toml. When the binding isn't present
 * (some local setups) it does nothing.
 */
export async function enforceAiRateLimit(userId: string): Promise<void> {
  // Optional at runtime: older local configs may not define the binding.
  const limiter = env.AI_LIMITER as Limiter | undefined;
  if (!limiter) return;
  const { success } = await limiter.limit({ key: userId });
  if (!success) {
    throw new ApiError("You're asking too quickly. Try again in a minute.", 429);
  }
}
