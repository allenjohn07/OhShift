import { hc } from "hono/client";

export type { InferRequestType, InferResponseType } from "hono/client";
import type { AppType } from "./index";

/**
 * Typed RPC client for the frontend (`src/lib/rpc.ts`). Built here so the
 * frontend uses the backend's own `hono` copy — one set of types end to end.
 */
export type ApiClient = ReturnType<typeof hc<AppType>>;

export const createApiClient = (...args: Parameters<typeof hc>): ApiClient =>
  hc<AppType>(...args);
