// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
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
  checkAuth: () => Promise<void>;
  isLoading: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Функция для декодирования JWT без проверки подписи
function decodeJwt(token: string): { exp: number; sub: string } | null {
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

// Функции для хранения и получения данных пользователя из кэша
const STORAGE_KEYS = {
  TOKEN: "token",
  USER_DATA: "user_data",
};

const getUserCache = (): UserData | null => {
  if (typeof window === "undefined") return null;
  const cached = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  return cached ? JSON.parse(cached) : null;
};

const setUserCache = (data: UserData | null) => {
  if (typeof window === "undefined") return;
  if (data) {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    setIsLoading(true);

    let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
      console.log("Токен отсутствует в localStorage");
      setIsAuth(false);
      setUserData(null);
      setUserCache(null);
      setIsLoading(false);
      return;
    }

    // Проверяем формат токена
    if (token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    // Проверяем, истёк ли токен
    if (isTokenExpired(token)) {
      console.log("Токен истёк");
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      setUserCache(null);
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      return;
    }

    // Декодируем токен, чтобы получить данные пользователя
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.sub) {
      console.log("Не удалось декодировать токен");
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      setUserCache(null);
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      return;
    }

    // Загружаем данные из кэша
    const cachedData = getUserCache();
    if (cachedData) {
      setUserData(cachedData);
      setIsAuth(true);
    } else {
      // Если кэш отсутствует, сбрасываем авторизацию
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      setUserCache(null);
      setIsAuth(false);
      setUserData(null);
    }

    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    setUserCache(null);
    setIsAuth(false);
    setUserData(null);
    router.push("/"); // Перенаправляем на главную страницу после выхода
  }, [router]);

  // Инициализация при монтировании компонента
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