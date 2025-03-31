// src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/api";
import { usePageLoad } from "@/contexts/PageLoadContext";

interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  avatar_url?: string;
}

interface AuthContextType {
  isAuth: boolean;
  userData: UserData | null;
  setIsAuth: (auth: boolean) => void;
  checkAuth: () => Promise<boolean>;
  isLoading: boolean;
  logout: () => void;
  handleLoginSuccess: (token: string, user: UserData) => void;
  updateUserData: (user: UserData, silent?: boolean) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TOKEN: "token",
  USER_DATA: "user_data",
};

interface JwtPayload {
  exp: number;
  sub: string;
  [key: string]: unknown;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded) return true;
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const isChecking = useRef(false);
  const authCheckPromise = useRef<Promise<boolean> | null>(null);
  const hasInitialized = useRef(false);
  const { wrapAsync, setPageLoading } = usePageLoad();

  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Return existing promise if already checking
    if (authCheckPromise.current) {
      return authCheckPromise.current;
    }
    
    // Create a new promise for this auth check
    authCheckPromise.current = (async () => {
      if (isChecking.current) {
        return isAuth; // Return current auth state if already checking
      }
      
      isChecking.current = true;
      setIsLoading(true);
      
      try {
        let token = localStorage.getItem(STORAGE_KEYS.TOKEN);

        if (!token) {
          setIsAuth(false);
          setUserData(null);
          return false;
        }

        if (token.startsWith("Bearer ")) token = token.slice(7).trim();
        if (isTokenExpired(token)) {
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          setIsAuth(false);
          setUserData(null);
          return false;
        }

        const cachedData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        let userDataFromCache = null;
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

        if (cachedData) {
          try {
            userDataFromCache = JSON.parse(cachedData);
            if (userDataFromCache.avatar_url && !userDataFromCache.avatar_url.startsWith('http')) {
              userDataFromCache.avatar_url = userDataFromCache.avatar_url.startsWith('/')
                ? `${baseUrl}${userDataFromCache.avatar_url}`
                : `${baseUrl}/${userDataFromCache.avatar_url}`;
            }
            
            // Use cached data and set auth to true
            setUserData(userDataFromCache);
            setIsAuth(true);
            
            // We'll still try to refresh in background but no need to wait
            setTimeout(() => {
              refreshUserData(token as string).catch(console.error);
            }, 0);
            
            return true;
          } catch {
            userDataFromCache = null;
          }
        }

        // If no valid cached data, fetch from API
        if (!userDataFromCache) {
          try {
            await refreshUserData(token);
            return true;
          } catch {
            // Failed to refresh, but we might still have cached data
            if (userDataFromCache) {
              setUserData(userDataFromCache);
              setIsAuth(true);
              return true;
            } else {
              setIsAuth(false);
              setUserData(null);
              return false;
            }
          }
        }
        
        return isAuth;
      } finally {
        setIsLoading(false);
        isChecking.current = false;
        
        // Clear the promise reference after completion
        setTimeout(() => {
          authCheckPromise.current = null;
        }, 0);
      }
    })();
    
    return authCheckPromise.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth]);
  
  // Helper function to refresh user data from API
  const refreshUserData = async (token: string): Promise<boolean> => {
    try {
      const response = await wrapAsync(
        apiFetch<Response>("/user_edits/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      
      if (response.ok) {
        const freshData = await response.json();
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        
        if (freshData.avatar_url) {
          freshData.avatar_url = freshData.avatar_url.startsWith('http')
            ? freshData.avatar_url
            : `${baseUrl}${freshData.avatar_url.startsWith('/') ? freshData.avatar_url : `/${freshData.avatar_url}`}`;
        }
        
        setUserData(freshData);
        setIsAuth(true);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(freshData));
        return true;
      } else {
        throw new Error("Failed to fetch fresh user data");
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      throw error;
    }
  };

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    setIsAuth(true);
    setUserData(user);
    setIsLoading(false);
    setPageLoading(false);
    window.dispatchEvent(new Event('auth-change'));
  }, [setPageLoading]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    setIsAuth(false);
    setUserData(null);
    window.dispatchEvent(new Event('auth-change'));
    if (window.location.pathname === "/profile") {
      router.push("/");
    }
  }, [router]);

  const updateUserData = useCallback((user: UserData, silent: boolean = false) => {
    setUserData(user);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    if (!silent) {
      window.dispatchEvent(new Event('auth-change'));
    }
  }, []);

  useEffect(() => {
    // Initialize only once
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      
      checkAuth()
        .catch(error => {
          console.error("Auth initialization error:", error);
        })
        .finally(() => {
          setIsLoading(false);
          setPageLoading(false);
        });
    }
    
    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn("AuthContext: Force resetting loading state after timeout");
        setIsLoading(false);
        setPageLoading(false);
        isChecking.current = false;
        authCheckPromise.current = null;
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [checkAuth, isLoading, setPageLoading]);

  const contextValue: AuthContextType = {
    isAuth,
    userData,
    setIsAuth,
    checkAuth,
    isLoading,
    logout,
    handleLoginSuccess,
    updateUserData,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};