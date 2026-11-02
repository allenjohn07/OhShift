import { getAccessToken } from "@/lib/auth-storage";

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * fetch for API calls (used by the typed client in `@/lib/rpc`): adds the
 * stored bearer token unless the call set its own Authorization header, and
 * turns network failures / timeouts into readable errors.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await fetch(input, { ...init, headers });
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      throw new Error(
        "Request timed out. The server may be waking up — wait a moment and try again.",
      );
    }
    if (err instanceof TypeError) {
      throw new Error(
        `Cannot reach API at ${API_URL}. Verify VITE_API_URL and backend CORS/availability in production.`,
      );
    }
    throw err;
  }
}
