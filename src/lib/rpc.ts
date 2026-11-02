import {
  createApiClient,
  type InferResponseType,
} from "../../backend/src/client";
import { API_URL, authedFetch } from "@/lib/api";

/**
 * Typed API client (Hono RPC) — paths, params, query, bodies and responses
 * come from the backend routes, e.g.
 *   await unwrap(rpc.shifts.$post({ json: { … } }), "Could not create shift")
 *   rpc["time-off"][":id"].review.$post({ param: { id }, json: { decision } })
 * Uses the stored token; pass `{ headers: { Authorization } }` to override.
 */
export const rpc = createApiClient(API_URL, { fetch: authedFetch });

type ErrorBody = { error: string };

/** JSON body type of a (union of) RPC responses. */
type JsonOf<R> = R extends { json(): Promise<infer T> } ? T : never;

/** The non-error response shapes of an RPC call. */
export type Success<T> = Exclude<T, ErrorBody>;

/** Success payload of an endpoint: `ApiData<typeof rpc.dashboard.company.$get>`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiData<F extends (...args: any[]) => any> = Success<InferResponseType<F>>;

/** Thrown by `unwrap` for non-2xx responses; `status` lets callers skip 401 toasts. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Await an RPC call and return its success payload; on a non-2xx response,
 * throw an ApiRequestError with the API's `error` message (or `fallback`).
 */
export async function unwrap<
  R extends { ok: boolean; status: number; json(): Promise<unknown> },
>(
  call: Promise<R>,
  fallback = "Request failed",
): Promise<Success<JsonOf<R>>> {
  const res = await call;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(apiError(data, fallback), res.status);
  return data as Success<JsonOf<R>>;
}

/** The API's `error` message from a parsed response body, or `fallback`. */
export function apiError(data: unknown, fallback: string): string {
  const error =
    data && typeof data === "object" && "error" in data ? data.error : undefined;
  return typeof error === "string" && error ? error : fallback;
}

/** Bearer header for calls made before the token is stored (login, /auth/me). */
export function withToken(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}
