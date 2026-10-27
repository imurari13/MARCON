import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrentUser } from "../types";
import { apiRequest, clearApiCache, setUnauthorizedHandler, warmCache } from "../services/api";

interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string, organizationId?: string) => Promise<boolean>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await apiRequest<{ user: CurrentUser | null }>("/auth/me");
      setUser(r.user);
      if (r.user) warmCache(r.user.role === "CEO" || r.user.role === "HR");
    } catch (error) {
      console.error("Unable to refresh the signed-in profile:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refresh]);
  useEffect(() => {
    setUnauthorizedHandler(() => { clearApiCache(); setUser(null); });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (email: string, password: string, organizationId = "default") => {
    const r = await apiRequest<{ user?: CurrentUser; mfaRequired?: boolean }>("/auth/login", { method: "POST", headers: { "X-Organization": organizationId }, body: JSON.stringify({ email, password }) });
    if (r.mfaRequired) return true;
    if (r.user) { clearApiCache(); setUser(r.user); warmCache(r.user.role === "CEO" || r.user.role === "HR"); }
    return false;
  };
  const verifyMfa = async (code: string) => { const r = await apiRequest<{ user: CurrentUser }>("/auth/mfa/verify-login", { method: "POST", body: JSON.stringify({ code }) }); clearApiCache(); setUser(r.user); warmCache(r.user.role === "CEO" || r.user.role === "HR"); };
  const logout = async () => {
    try { await apiRequest<void>("/auth/logout", { method: "POST" }); } finally { clearApiCache(); setUser(null); }
  };

  return <Context.Provider value={{ user, loading, login, verifyMfa, logout, refresh }}>{children}</Context.Provider>;
}

export function useAuth() {
  const v = useContext(Context);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
