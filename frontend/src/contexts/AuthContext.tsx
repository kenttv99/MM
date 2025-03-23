// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ValidationError } from "next/dist/compiled/amphtml-validator";

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
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TOKEN: "token",
  USER_DATA: "user_data",
};

// Функция для декодирования JWT без проверки подписи
function decodeJwt(token: string): { exp: number; sub: string; [key: string]: ValidationError } | null {
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

// Проверяем, истёк ли срок действия токена
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

  const checkAuth = useCallback(() => {
    setIsLoading(true);

    let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      return;
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    if (isTokenExpired(token)) {
      console.log("Токен истёк");
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      return;
    }

    const decoded = decodeJwt(token);
    const cachedData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (decoded && cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setUserData(parsedData);
        setIsAuth(true);
      } catch (err) {
        console.error("Ошибка при парсинге кэшированных данных:", err);
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        setIsAuth(false);
        setUserData(null);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      setIsAuth(false);
      setUserData(null);
    }

    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    setIsAuth(false);
    setUserData(null);
    router.push("/");
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const contextValue = {
    isAuth,
    userData,
    setIsAuth,
    checkAuth,
    isLoading,
    logout,
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