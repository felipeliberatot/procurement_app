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

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        console.log("[AuthContext] Web platform: fetching user from API...");

        // First, try to use cached user info for immediate display
        const cachedUser = await Auth.getUserInfo();
        if (cachedUser) {
          console.log("[AuthContext] Web: using cached user info for immediate display");
          setUser(cachedUser);
          // Don't set loading to false yet — still verify with server
        }

        const apiUser = await Api.getMe();
        console.log("[AuthContext] API user response:", apiUser);

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
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          console.log("[AuthContext] Web user set from API:", userInfo);
        } else {
          console.log("[AuthContext] Web: No authenticated user from API");
          // Only clear if we didn't have a cached user that was just set
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      console.log("[AuthContext] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        console.log("[AuthContext] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        console.log("[AuthContext] Using cached user info");
        setUser(cachedUser);
      } else {
        console.log("[AuthContext] No cached user, setting user to null");
        setUser(null);
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
