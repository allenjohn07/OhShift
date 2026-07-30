"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

export function useApi() {
  const { accessToken } = useAuth();

  return useCallback(
    (path: string, init: RequestInit = {}) =>
      apiFetch(path, { ...init, token: accessToken }),
    [accessToken],
  );
}
