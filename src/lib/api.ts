import { getAccessToken } from "@/lib/auth-storage";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchWithNetworkErrorHint(
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Cannot reach API at ${API_URL}. Verify NEXT_PUBLIC_API_URL and backend CORS/availability in production.`,
      );
    }
    throw err;
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit & { token?: string | null; timeoutMs?: number } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token =
    init.token !== undefined ? init.token : getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const timeoutMs = init.timeoutMs;
  const rest: RequestInit = { ...init };
  delete (rest as { token?: unknown }).token;
  delete (rest as { timeoutMs?: unknown }).timeoutMs;

  if (timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchWithNetworkErrorHint(`${API_URL}${path}`, {
        ...rest,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          "Request timed out. The server may be waking up — wait a moment and try again.",
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return fetchWithNetworkErrorHint(`${API_URL}${path}`, { ...rest, headers });
}

export async function parseApiJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
