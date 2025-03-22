// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AdminData {
  id: number;
  fio: string;
  email: string;
  avatar_url?: string;
}

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminData | null;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logoutAdmin: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ADMIN_TOKEN: 'admin_token',
  ADMIN_DATA: 'admin_data'
};

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

const setAdminCache = (data: AdminData | null) => {
  if (typeof window === 'undefined') return;
  if (data) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
  }
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    setIsLoading(true);

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      console.log("Токен отсутствует в localStorage");
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    // Проверяем, истёк ли токен
    if (isTokenExpired(token)) {
      console.log("Токен истёк");
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      setAdminCache(null);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    // Декодируем токен, чтобы получить данные администратора
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.sub) {
      console.log("Не удалось декодировать токен");
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      setAdminCache(null);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    // Загружаем данные из кэша
    const cachedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setAdminData(parsedData);
        setIsAdminAuth(true);
      } catch (err) {
        console.error("Ошибка при парсинге кэшированных данных:", err);
        setAdminCache(null);
        setIsAdminAuth(false);
        setAdminData(null);
      }
    } else {
      // Если кэш отсутствует, сбрасываем авторизацию
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      setAdminCache(null);
      setIsAdminAuth(false);
      setAdminData(null);
    }

    setIsLoading(false);
  }, []);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    setAdminCache(null);
    setIsAdminAuth(false);
    setAdminData(null);
    router.push("/admin-login");
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const contextValue = {
    isAdminAuth,
    adminData,
    isLoading,
    checkAuth,
    logoutAdmin,
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};