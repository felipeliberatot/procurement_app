import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUserDirectly: (user: Auth.User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    console.log("[AuthContext] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Check for stored session token (works for both web and native)
      // Web: token stored in localStorage, sent as Bearer header
      // Native: token stored in SecureStore, sent as Bearer header
      const sessionToken = await Auth.getSessionToken();
      console.log("[AuthContext] Session token:", sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing", "platform:", Platform.OS);

      if (!sessionToken) {
        // No stored token — check if cookie-based auth works (legacy web flow)
        if (Platform.OS === "web") {
          console.log("[AuthContext] Web: no localStorage token, trying cookie-based auth...");
          const cachedUser = await Auth.getUserInfo();
          if (cachedUser) {
            console.log("[AuthContext] Web: using cached user info for immediate display");
            setUser(cachedUser);
          }
          const apiUser = await Api.getMe();
          if (apiUser) {
            const userInfo: Auth.User = {
              id: apiUser.id,
              openId: apiUser.openId,
              name: apiUser.name,
              email: apiUser.email,
              loginMethod: apiUser.loginMethod,
              lastSignedIn: new Date(apiUser.lastSignedIn),
              procurementRole: (apiUser as any).procurementRole ?? null,
              approvalLevel: (apiUser as any).approvalLevel ?? null,
              extraRoles: (apiUser as any).extraRoles ?? null,
              extraApprovalLevels: (apiUser as any).extraApprovalLevels ?? null,
              phone: (apiUser as any).phone ?? null,
              active: (apiUser as any).active ?? true,
            };
            setUser(userInfo);
            await Auth.setUserInfo(userInfo);
            console.log("[AuthContext] Web: user set from cookie-based API:", userInfo);
          } else {
            console.log("[AuthContext] Web: no authenticated user from cookie-based API");
            setUser(null);
            await Auth.clearUserInfo();
          }
        } else {
          console.log("[AuthContext] Native: no session token, setting user to null");
          setUser(null);
        }
        return;
      }

      // Token exists — use cached user info for immediate display
      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        console.log("[AuthContext] Using cached user info for immediate display");
        setUser(cachedUser);
      }

      // Verify token with server (getMe will send Bearer token via api.ts)
      const apiUser = await Api.getMe();
      console.log("[AuthContext] API user response:", apiUser ? apiUser.name : "null");
      if (apiUser) {
        const userInfo: Auth.User = {
          id: apiUser.id,
          openId: apiUser.openId,
          name: apiUser.name,
          email: apiUser.email,
          loginMethod: apiUser.loginMethod,
          lastSignedIn: new Date(apiUser.lastSignedIn),
          procurementRole: (apiUser as any).procurementRole ?? null,
          approvalLevel: (apiUser as any).approvalLevel ?? null,
          extraRoles: (apiUser as any).extraRoles ?? null,
          extraApprovalLevels: (apiUser as any).extraApprovalLevels ?? null,
          phone: (apiUser as any).phone ?? null,
          active: (apiUser as any).active ?? true,
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
        console.log("[AuthContext] User verified and updated from API:", userInfo.name);
      } else {
        // Token invalid or expired — clear everything
        console.log("[AuthContext] Token invalid/expired, clearing session");
        setUser(null);
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[AuthContext] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[AuthContext] fetchUser completed");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[AuthContext] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  // Allow setting user directly after login (avoids extra getMe() call)
  const setUserDirectly = useCallback((newUser: Auth.User) => {
    console.log("[AuthContext] setUserDirectly called:", newUser);
    setUser(newUser);
    setLoading(false);
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[AuthContext] Initial fetch, platform:", Platform.OS);
    if (Platform.OS === "web") {
      fetchUser();
    } else {
      // Native: check for cached user info first for faster initial load
      Auth.getUserInfo().then((cachedUser) => {
        if (cachedUser) {
          console.log("[AuthContext] Native: setting cached user immediately");
          setUser(cachedUser);
          setLoading(false);
        } else {
          fetchUser();
        }
      });
    }
  }, [fetchUser]);

  const value = useMemo(
    () => ({ user, loading, error, isAuthenticated, refresh: fetchUser, logout, setUserDirectly }),
    [user, loading, error, isAuthenticated, fetchUser, logout, setUserDirectly],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
