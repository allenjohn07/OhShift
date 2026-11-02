import { ApiError } from "./auth-guard";
export function messageCursor(message: { id: string; createdAt: Date }) {
  return btoa(JSON.stringify({ id: message.id, at: message.createdAt.getTime() })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function parseMessageCursor(value: string | undefined): { id: string; at: Date } | null {
  if (value === undefined) return null;
  try {
    if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const parsed = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))) as { id: unknown; at: unknown };
    if (typeof parsed.id !== "string" || !parsed.id || parsed.id.length > 100 || typeof parsed.at !== "number" || !Number.isSafeInteger(parsed.at) || !Number.isFinite(new Date(parsed.at).getTime())) throw new Error();
    return { id: parsed.id, at: new Date(parsed.at) };
  } catch { throw new ApiError("Invalid message history cursor", 400); }
}
