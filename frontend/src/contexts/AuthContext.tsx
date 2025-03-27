// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react"; // Добавлен useRef
import { useRouter } from "next/navigation";

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
  updateUserData: (user: UserData) => void;
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
  } catch (err) {
    console.error("Ошибка при декодировании токена:", err);
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

  const checkAuth = useCallback(() => {
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
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setUserData(parsedData);
        setIsAuth(true);
      } catch {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        setIsAuth(false);
        setUserData(null);
      }
    }
    setIsLoading(false);
    isChecking.current = false;
  }, []);

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    setIsAuth(true);
    setUserData(user);
    window.dispatchEvent(new Event('auth-change'));
    setIsLoading(false);
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

  const updateUserData = useCallback((user: UserData) => {
    setUserData(user);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    window.dispatchEvent(new Event('auth-change'));
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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