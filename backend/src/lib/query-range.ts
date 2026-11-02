import type { Context } from "hono";
import { ApiError } from "./auth-guard";
const DAY = 86_400_000;
export function queryRange(c: Context) {
  const from = c.req.query("from"), to = c.req.query("to");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (!from && !to) return { start: new Date(today.getTime() - 8 * DAY), end: new Date(today.getTime() + 14 * DAY) };
  const start = new Date(from ?? ""), end = new Date(to ?? "");
  if (!from || !to || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() - start.getTime() > 31 * DAY) {
    throw new ApiError("Provide a valid from/to range of at most 31 days.", 400);
  }
  return { start, end };
}
