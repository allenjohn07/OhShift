"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

export function useApi() {
  const { accessToken } = useAuth();

  return (path: string, init: RequestInit = {}) =>
    apiFetch(path, { ...init, token: accessToken });
}
