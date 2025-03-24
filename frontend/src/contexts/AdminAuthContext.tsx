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
  checkAuth: () => void;
  logoutAdmin: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ADMIN_TOKEN: 'admin_token',
  ADMIN_DATA: 'admin_data'
};

// Интерфейс для результата декодирования JWT
interface JwtPayload {
  exp: number;
  sub: string;
  [key: string]: unknown; // Для дополнительных полей в токене
}

// Функция для декодирования JWT без проверки подписи
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

// Проверяем, истёк ли срок действия токена
function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded) return true;
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const checkAuth = useCallback(() => {
    setIsLoading(true);

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    if (isTokenExpired(token)) {
      console.log("Токен истёк");
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    const decoded = decodeJwt(token);
    const cachedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
    console.log("Загруженные данные из localStorage (admin_data):", cachedData);

    if (decoded && cachedData) {
      try {
        const parsedData: AdminData = JSON.parse(cachedData);
        console.log("Распарсенные данные из localStorage:", parsedData);
        setAdminData(parsedData);
        setIsAdminAuth(true);
      } catch (err) {
        console.error("Ошибка при парсинге кэшированных данных:", err);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
        setIsAdminAuth(false);
        setAdminData(null);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAdminAuth(false);
      setAdminData(null);
    }

    setIsLoading(false);
  }, []);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
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