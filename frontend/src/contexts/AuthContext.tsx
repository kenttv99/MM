// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
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
  checkAuth: () => Promise<boolean>;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

// Проверяем, истек ли срок действия токена
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
  const isInitialLoad = useRef(true);
  const fetchingUserData = useRef(false);
  const checkAuthInProgress = useRef(false);
  const router = useRouter();

  // Функция для загрузки данных пользователя с сервера
  const fetchUserData = useCallback(async (): Promise<UserData | null> => {
    if (fetchingUserData.current) return null;

    fetchingUserData.current = true;

    try {
      let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) return null;

      // Проверяем и извлекаем токен, если он в формате "Bearer "
      if (token.startsWith("Bearer ")) {
        token = token.slice(7).trim();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUserCache(data);
        return data;
      }

      return null;
    } catch (error) {
      console.error("Ошибка загрузки данных пользователя:", error);
      return null;
    } finally {
      fetchingUserData.current = false;
    }
  }, []);

  // Функция для проверки авторизации
  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (checkAuthInProgress.current) return isAuth;

    checkAuthInProgress.current = true;

    try {
      setIsLoading(true);

      let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) {
        setIsAuth(false);
        setUserData(null);
        setUserCache(null);
        return false;
      }

      // Проверяем формат токена
      if (token.startsWith("Bearer ")) {
        token = token.slice(7).trim();
      }

      if (isTokenExpired(token)) {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        setUserCache(null);
        setIsAuth(false);
        setUserData(null);
        return false;
      }

      setIsAuth(true);

      if (!userData) {
        const cachedData = getUserCache();
        if (cachedData) {
          setUserData(cachedData);
        }
      }

      if (isInitialLoad.current) {
        isInitialLoad.current = false;

        const fetchedData = await fetchUserData();
        if (fetchedData) {
          setUserData(fetchedData);
        } else if (!getUserCache()) {
          // Если данные не удалось загрузить и кэш пуст, считаем пользователя неавторизованным
          setIsAuth(false);
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Ошибка проверки авторизации:", error);
      return isAuth;
    } finally {
      setIsLoading(false);
      checkAuthInProgress.current = false;
    }
  }, [fetchUserData, isAuth, userData]);

  // Функция для выхода
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    setUserCache(null);
    setIsAuth(false);
    setUserData(null);
    window.dispatchEvent(new Event("auth-change"));
    router.push("/"); // Перенаправляем на главную страницу после выхода
  }, [router]);

  // Инициализация из кэша при монтировании компонента
  useEffect(() => {
    const initAuth = async () => {
      const cachedUser = getUserCache();
      let token = localStorage.getItem(STORAGE_KEYS.TOKEN);

      if (token && token.startsWith("Bearer ")) {
        token = token.slice(7).trim();
      }

      if (cachedUser && token && !isTokenExpired(token)) {
        setUserData(cachedUser);
        setIsAuth(true);
      } else {
        setIsAuth(false);
        if (!token) {
          setUserData(null);
        }
      }

      await checkAuth();
      setIsLoading(false);
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Настройка обработчиков событий
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TOKEN) {
        checkAuth();
      }
    };

    const handleAuthChange = () => checkAuth();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-change", handleAuthChange);
    };
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