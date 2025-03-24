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

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const checkAuth = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    const cachedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);

    if (!token || !cachedData) {
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return false;
    }

    if (isTokenExpired(token)) {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return false;
    }

    try {
      const parsedData: AdminData = JSON.parse(cachedData);
      setAdminData(parsedData);
      setIsAdminAuth(true);
      setIsLoading(false);
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return false;
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    router.push("/admin-login");
  }, [router]);

  useEffect(() => {
    checkAuth().catch(err => console.error("Initial checkAuth failed:", err));
  }, [checkAuth]);

  const contextValue: AdminAuthContextType = {
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