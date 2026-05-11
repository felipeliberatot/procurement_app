import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

  // Track whether a direct login was performed.
  // When true, any in-flight fetchUser() will NOT overwrite the state with null.
  const directLoginRef = useRef(false);
  // Generation counter: each fetchUser() call gets a unique ID.
  // If a newer call starts before the old one finishes, the old one is discarded.
  const fetchGenRef = useRef(0);

  const fetchUser = useCallback(async () => {
    // Increment generation — this call owns this generation
    const myGen = ++fetchGenRef.current;

    // If a direct login was just performed, skip the fetch entirely
    if (directLoginRef.current) {
      console.log("[AuthContext] fetchUser skipped — direct login in progress");
      return;
    }

    console.log("[AuthContext] fetchUser called, gen:", myGen);
    try {
      setLoading(true);
      setError(null);

      // Check for stored session token (works for both web and native)
      const sessionToken = await Auth.getSessionToken();
      console.log("[AuthContext] Session token:", sessionToken ? `present` : "missing", "platform:", Platform.OS);

      if (!sessionToken) {
        // No stored token — check if cookie-based auth works (legacy web flow)
        if (Platform.OS === "web") {
          console.log("[AuthContext] Web: no localStorage token, trying cookie-based auth...");
          const apiUser = await Api.getMe();
          // Check if this generation is still valid
          if (myGen !== fetchGenRef.current) {
            console.log("[AuthContext] fetchUser gen", myGen, "superseded, discarding");
            return;
          }
          if (apiUser) {
            const userInfo: Auth.User = buildUserInfo(apiUser);
            setUser(userInfo);
            await Auth.setUserInfo(userInfo);
          } else {
            setUser(null);
            await Auth.clearUserInfo();
          }
        } else {
          setUser(null);
        }
        return;
      }

      // Token exists — use cached user info for immediate display
      const cachedUser = await Auth.getUserInfo();
      if (myGen !== fetchGenRef.current || directLoginRef.current) {
        console.log("[AuthContext] fetchUser gen", myGen, "superseded after cache check, discarding");
        return;
      }
      if (cachedUser) {
        setUser(cachedUser);
      }

      // Verify token with server (getMe will send Bearer token via api.ts)
      const apiUser = await Api.getMe();

      // Check again — a direct login may have happened while we were waiting
      if (myGen !== fetchGenRef.current || directLoginRef.current) {
        console.log("[AuthContext] fetchUser gen", myGen, "superseded after API call, discarding");
        return;
      }

      if (apiUser) {
        const userInfo: Auth.User = buildUserInfo(apiUser);
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
        console.log("[AuthContext] User verified from API:", userInfo.name);
      } else {
        // Token invalid or expired — clear everything
        console.log("[AuthContext] Token invalid/expired, clearing session");
        setUser(null);
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
      }
    } catch (err) {
      if (myGen !== fetchGenRef.current || directLoginRef.current) return;
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[AuthContext] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      if (myGen === fetchGenRef.current && !directLoginRef.current) {
        setLoading(false);
        console.log("[AuthContext] fetchUser completed, gen:", myGen);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    directLoginRef.current = false;
    fetchGenRef.current++; // Invalidate any in-flight fetchUser
    try {
      await Api.logout();
    } catch (err) {
      console.error("[AuthContext] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  // Allow setting user directly after login (avoids extra getMe() call)
  // This also prevents any in-flight fetchUser() from overwriting the state
  const setUserDirectly = useCallback((newUser: Auth.User) => {
    console.log("[AuthContext] setUserDirectly called:", newUser.name);
    // Mark direct login — prevents in-flight fetchUser from overwriting
    directLoginRef.current = true;
    // Increment generation to invalidate any in-flight fetchUser
    fetchGenRef.current++;
    setUser(newUser);
    setLoading(false);
    setError(null);
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[AuthContext] Initial fetch, platform:", Platform.OS);
    fetchUser();
  }, [fetchUser]);

  const value = useMemo(
    () => ({ user, loading, error, isAuthenticated, refresh: fetchUser, logout, setUserDirectly }),
    [user, loading, error, isAuthenticated, fetchUser, logout, setUserDirectly],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function buildUserInfo(apiUser: any): Auth.User {
  return {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name,
    email: apiUser.email,
    loginMethod: apiUser.loginMethod,
    lastSignedIn: new Date(apiUser.lastSignedIn),
    procurementRole: apiUser.procurementRole ?? null,
    approvalLevel: apiUser.approvalLevel ?? null,
    extraRoles: apiUser.extraRoles ?? null,
    extraApprovalLevels: apiUser.extraApprovalLevels ?? null,
    phone: apiUser.phone ?? null,
    active: apiUser.active ?? true,
  };
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
