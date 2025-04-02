// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/api";
import { usePageLoad } from "@/contexts/PageLoadContext";
import AuthModal from "@/components/common/AuthModal";
import Login from "@/components/Login";

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
  openLoginModal: () => void;
  isLoginModalOpen: boolean;
  closeLoginModal: () => void;
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [authCheckCount, setAuthCheckCount] = useState<number>(0);
  const router = useRouter();
  const isChecking = useRef(false);
  const authCheckPromise = useRef<Promise<boolean> | null>(null);
  const hasInitialized = useRef(false);
  const lastCheckTime = useRef<number>(0);
  const { setPageLoading } = usePageLoad();

  const MAX_AUTH_CHECKS = 5;
  const CHECK_INTERVAL = 5000;

  const refreshUserData = async (token: string): Promise<boolean> => {
    try {
      const freshData = await apiFetch<UserData>("/user_edits/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

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
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      return false;
    }
  };

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    
    // Throttle check frequency
    if (now - lastCheckTime.current < CHECK_INTERVAL) {
      setAuthCheckCount((prev) => prev + 1);
      if (authCheckCount + 1 >= MAX_AUTH_CHECKS) {
        return false;
      }
    } else {
      setAuthCheckCount(0);
    }
    lastCheckTime.current = now;

    // Reuse existing promise if one is in flight
    if (authCheckPromise.current) {
      return authCheckPromise.current;
    }

    authCheckPromise.current = (async () => {
      if (isChecking.current) {
        return isAuth;
      }

      isChecking.current = true;
      setIsLoading(true);

      try {
        let token = localStorage.getItem(STORAGE_KEYS.TOKEN);

        // No token means not authenticated
        if (!token) {
          setIsAuth(false);
          setUserData(null);
          return false;
        }

        // Clean token format
        if (token.startsWith("Bearer ")) token = token.slice(7).trim();
        
        // Check token expiration
        if (isTokenExpired(token)) {
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          setIsAuth(false);
          setUserData(null);
          return false;
        }

        // Try to use cached user data
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

            setUserData(userDataFromCache);
            setIsAuth(true);

            // Try to refresh data in background
            const refreshed = await refreshUserData(token);
            if (!refreshed) {
              console.warn("Using cached data as refresh failed");
            }
            return true;
          } catch {
            userDataFromCache = null;
          }
        }

        // Refresh user data from server
        const refreshed = await refreshUserData(token);
        if (refreshed) {
          return true;
        } else if (userDataFromCache) {
          setUserData(userDataFromCache);
          setIsAuth(true);
          return true;
        } else {
          setIsAuth(false);
          setUserData(null);
          return false;
        }
      } finally {
        setIsLoading(false);
        isChecking.current = false;
        setTimeout(() => {
          authCheckPromise.current = null;
        }, 0);
      }
    })();

    return authCheckPromise.current;
  }, [authCheckCount, isAuth]);

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    setIsAuth(true);
    setUserData(user);
    setIsLoading(false);
    setPageLoading(false);
    setIsLoginModalOpen(false);
    window.dispatchEvent(new Event('auth-change'));
  }, [setPageLoading]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    setIsAuth(false);
    setUserData(null);
    window.dispatchEvent(new Event('auth-change'));
    router.push("/"); // Always redirect to home page on logout
  }, [router]);

  const updateUserData = useCallback((user: UserData, silent: boolean = false) => {
    setUserData(user);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    if (!silent) {
      window.dispatchEvent(new Event('auth-change'));
    }
  }, []);

  const openLoginModal = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  useEffect(() => {
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

    const timeout = setTimeout(() => {
      if (isLoading) {
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
    openLoginModal,
    isLoginModalOpen,
    closeLoginModal,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {isLoginModalOpen && (
        <AuthModal
          isOpen={isLoginModalOpen}
          onClose={closeLoginModal}
          title="Вход"
        >
          <Login isOpen={isLoginModalOpen} onClose={closeLoginModal} />
        </AuthModal>
      )}
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