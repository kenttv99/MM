// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from "react";

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
  checkAuth: () => Promise<boolean>;
  logoutAdmin: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ADMIN_TOKEN: 'admin_token',
  ADMIN_DATA: 'admin_data'
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
  if (!decoded || !decoded.exp) return true;
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

// frontend/src/contexts/AdminAuthContext.tsx
export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const hasCheckedAuth = useRef(false);
  const isChecking = useRef(false);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (isChecking.current) return false;
    isChecking.current = true;
    setIsLoading(true);
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    const cachedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);

    if (!token || !cachedData || isTokenExpired(token)) {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      isChecking.current = false;
      return false;
    }

    try {
      const parsedData: AdminData = JSON.parse(cachedData);
      setAdminData(parsedData);
      setIsAdminAuth(true);
      setIsLoading(false);
      isChecking.current = false;
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      isChecking.current = false;
      return false;
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    router.push("/admin-login", { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      checkAuth().catch(err => console.error("Initial checkAuth failed:", err));
    }
  }, [checkAuth]);

  const contextValue: AdminAuthContextType = {
    isAdminAuth,
    adminData,
    isLoading,
    checkAuth,
    logoutAdmin, // Явно добавляем logoutAdmin
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
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};