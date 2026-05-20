"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, parseApiJson } from "@/lib/api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-storage";

export type AuthProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  company_id: string | null;
  avatar_url?: string | null;
  companies?: { name: string } | null;
  [key: string]: unknown;
};

type AuthUser = {
  id: string;
  email: string;
  profile: AuthProfile;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setTokenState(null);
      return;
    }

    const res = await apiFetch("/auth/me", { token });
    const data = await parseApiJson<{ user: AuthUser | null }>(res);

    if (!data.user) {
      clearAccessToken();
      setUser(null);
      setTokenState(null);
      return;
    }

    setAccessToken(token);
    setTokenState(token);
    setUser(data.user);
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      token: null,
    });

    const data = await parseApiJson<{
      accessToken?: string;
      user?: AuthUser;
      error?: string;
    }>(res);

    if (!res.ok || !data.accessToken || !data.user) {
      throw new Error(data.error || "Invalid credentials");
    }

    setAccessToken(data.accessToken);
    setTokenState(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setTokenState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      logout,
      refreshUser,
    }),
    [user, accessToken, loading, login, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
