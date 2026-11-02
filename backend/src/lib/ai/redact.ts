import type { AskResult } from "./types";

/**
 * Defence in depth. Executors already select only allow-listed columns (never
 * `select()` on users, never notes / emails / hashes), so nothing sensitive
 * should reach an answer. This scans what we are about to return and replaces
 * anything that looks like a secret or an email with a safe message.
 */
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const PASSWORD_HASH = /pbkdf2\$/i;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/;
const LONG_SECRET = /\b[A-Za-z0-9+/_-]{40,}={0,2}\b/;

export const SAFE_FALLBACK =
  "I can't share that. Try asking about the schedule, your team, or announcements.";

export function containsSensitive(text: string): boolean {
  return (
    EMAIL.test(text) ||
    PASSWORD_HASH.test(text) ||
    JWT.test(text) ||
    LONG_SECRET.test(text)
  );
}

/** Returns the text unchanged when clean, otherwise `fallback`. */
export function guardText(text: string, fallback = SAFE_FALLBACK): string {
  return containsSensitive(text) ? fallback : text;
}

/** Scans every user-visible string in a result. */
export function guardResult(result: AskResult): AskResult {
  if ("error" in result) {
    return { error: guardText(result.error) };
  }
  if (result.kind === "create") return result;

  if (result.kind === "help") {
    return {
      ...result,
      answer: guardText(result.answer),
      suggestions: result.suggestions.filter((s) => !containsSensitive(s)),
    };
  }

  const strings = [
    result.answer,
    result.window_label,
    ...result.sources.map((s) => s.title),
  ];
  if (strings.some(containsSensitive)) {
    return { ...result, answer: SAFE_FALLBACK, sources: [], shifts: [] };
  }
  return result;
}
