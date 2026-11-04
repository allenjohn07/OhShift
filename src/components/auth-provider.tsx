import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { rpc, unwrap, withToken } from "@/lib/rpc";
import {
  SESSION_EXPIRED_EVENT,
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
  /** Store a session issued by another endpoint (the demo's start / role switch). */
  adoptSession: (session: { user: AuthUser; accessToken: string }) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const queryClient = useQueryClient();
  const sessionTokenRef = useRef<string | null>(null);

  const applySession = useCallback((nextUser: AuthUser | null, token: string | null) => {
    const nextToken = nextUser && token ? token : null;
    // New user (or logged out): drop cached data so nothing leaks across sessions.
    if (nextToken !== sessionTokenRef.current) {
      sessionTokenRef.current = nextToken;
      queryClient.clear();
    }
    if (nextUser && token) {
      setAccessToken(token);
      setTokenState(token);
      setUser(nextUser);
      return;
    }
    clearAccessToken();
    setUser(null);
    setTokenState(null);
  }, [queryClient]);

  useEffect(() => {
    const expired = (event: Event) => {
      if ((event as CustomEvent<string>).detail === sessionTokenRef.current) applySession(null, null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      applySession(null, null);
      return;
    }

    try {
      const data = await unwrap(rpc.auth.me.$get(undefined, withToken(token)));

      if (!data.user) {
        applySession(null, null);
        return;
      }

      applySession(data.user, token);
    } catch {
      applySession(null, null);
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Yield so session updates are not synchronous inside the effect body.
        await Promise.resolve();
        const token = getAccessToken();
        if (!token) {
          if (!cancelled) applySession(null, null);
          return;
        }

        const data = await unwrap(rpc.auth.me.$get(undefined, withToken(token)));
        if (cancelled) return;

        if (!data.user) {
          applySession(null, null);
          return;
        }

        applySession(data.user, token);
      } catch {
        // API down / network — stay logged out; don't leave an unhandled rejection
        if (!cancelled) applySession(null, null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await unwrap(
      rpc.auth.login.$post({ json: { email, password } }),
      "Invalid credentials",
    );

    applySession(data.user, data.accessToken);
    return data.user;
  }, [applySession]);

  const adoptSession = useCallback((session: { user: AuthUser; accessToken: string }) => {
    applySession(session.user, session.accessToken);
  }, [applySession]);

  const logout = useCallback(() => {
    applySession(null, null);
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      adoptSession,
      logout,
      refreshUser,
    }),
    [user, accessToken, loading, login, adoptSession, logout, refreshUser],
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
