import { AsyncLocalStorage } from "node:async_hooks";

export const NL_SHIFT_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Minimal Workers AI binding shape used by Ask OhShift. */
export type WorkersAiBinding = {
  run(
    model: string,
    input: {
      messages: AiMessage[];
      max_tokens?: number;
      temperature?: number;
    },
  ): Promise<unknown>;
};

const aiAls = new AsyncLocalStorage<WorkersAiBinding | null>();

export function runWithWorkersAi<T>(
  binding: WorkersAiBinding | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return aiAls.run(binding ?? null, fn);
}

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

async function runViaRest(messages: AiMessage[]): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for local use, or deploy with the AI binding.",
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${NL_SHIFT_MODEL}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      max_tokens: 512,
      temperature: 0.1,
    }),
  });

  const data = (await res.json()) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: unknown;
  };

  if (!res.ok || data.success === false) {
    const msg =
      data.errors?.[0]?.message ??
      `Workers AI request failed (${res.status})`;
    throw new Error(msg);
  }

  return extractText(data.result ?? data);
}

/**
 * Run a chat completion via the Workers AI binding (production) or
 * Cloudflare REST API (local Bun with account credentials).
 */
export async function runChatCompletion(
  messages: AiMessage[],
): Promise<string> {
  const binding = aiAls.getStore();
  if (binding) {
    const result = await binding.run(NL_SHIFT_MODEL, {
      messages,
      max_tokens: 512,
      temperature: 0.1,
    });
    return extractText(result);
  }
  return runViaRest(messages);
}
