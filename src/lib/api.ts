import { getAccessToken } from "@/lib/auth-storage";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch(
  path: string,
  init: RequestInit & { token?: string | null } = {},
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

  const { token: _token, ...rest } = init;
  return fetch(`${API_URL}${path}`, { ...rest, headers });
}

export async function parseApiJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
