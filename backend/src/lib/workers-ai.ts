import { env } from "cloudflare:workers";

export const NL_SHIFT_MODEL = "@cf/meta/llama-3.2-3b-instruct" as const;

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function coerceText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value === "object") {
    // Workers AI may parse JSON-looking model output into an object.
    return JSON.stringify(value);
  }
  return null;
}

function extractText(result: unknown): string {
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (trimmed) return trimmed;
    throw new Error("Workers AI returned no text");
  }
  if (!result || typeof result !== "object") {
    throw new Error("Unexpected Workers AI response");
  }

  const record = result as Record<string, unknown>;

  const fromResponse = coerceText(record.response);
  if (fromResponse) return fromResponse;

  if (record.result && typeof record.result === "object") {
    const nested = record.result as Record<string, unknown>;
    const fromNested = coerceText(nested.response);
    if (fromNested) return fromNested;
  }

  // OpenAI-compatible chat.completion shape
  if (Array.isArray(record.choices) && record.choices[0]) {
    const choice = record.choices[0] as Record<string, unknown>;
    const message = choice.message as Record<string, unknown> | undefined;
    const fromChoice =
      coerceText(message?.content) ?? coerceText(choice.text);
    if (fromChoice) return fromChoice;
  }

  throw new Error("Workers AI returned no text");
}

/** Run a chat completion via the Workers AI binding (also used by `wrangler dev`). */
export async function runChatCompletion(
  messages: AiMessage[],
): Promise<string> {
  if (!env.AI) {
    throw new Error("Workers AI is not configured. Add the [ai] binding in wrangler.toml.");
  }
  const result = await env.AI.run(NL_SHIFT_MODEL, {
    messages,
    max_tokens: 512,
    temperature: 0.1,
  });
  return extractText(result);
}
