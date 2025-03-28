// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/api";

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
  checkAuth: () => void;
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

  const checkAuth = useCallback(async () => {
    if (isChecking.current) return;
    isChecking.current = true;
    setIsLoading(true);
    let token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!token) {
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      isChecking.current = false;
      return;
    }

    if (token.startsWith("Bearer ")) token = token.slice(7).trim();
    if (isTokenExpired(token)) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      isChecking.current = false;
      return;
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
      } catch {
        userDataFromCache = null;
      }
    }

    if (!userDataFromCache || !userDataFromCache.avatar_url) {
      try {
        const response = await apiFetch("/user_edits/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const freshData = await response.json();
          if (freshData.avatar_url) {
            freshData.avatar_url = freshData.avatar_url.startsWith('http')
              ? freshData.avatar_url
              : `${baseUrl}${freshData.avatar_url.startsWith('/') ? freshData.avatar_url : `/${freshData.avatar_url}`}`;
          }
          setUserData(freshData);
          setIsAuth(true);
          localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(freshData));
        } else {
          throw new Error("Failed to fetch fresh user data");
        }
      } catch {
        if (userDataFromCache) {
          setUserData(userDataFromCache);
          setIsAuth(true);
        } else {
          setIsAuth(false);
          setUserData(null);
        }
      }
    } else {
      setUserData(userDataFromCache);
      setIsAuth(true);
    }

    setIsLoading(false);
    isChecking.current = false;
  }, []);

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    setIsAuth(true);
    setUserData(user);
    setIsLoading(false);
    window.dispatchEvent(new Event('auth-change'));
  }, []);

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
    checkAuth();
  }, [checkAuth]);

  const contextValue = {
    isAuth: isAuth,
    userData: userData,
    setIsAuth: setIsAuth,
    checkAuth: checkAuth,
    isLoading: isLoading,
    logout: logout,
    handleLoginSuccess: handleLoginSuccess,
    updateUserData: (user: UserData, silent?: boolean) => updateUserData(user, silent),
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