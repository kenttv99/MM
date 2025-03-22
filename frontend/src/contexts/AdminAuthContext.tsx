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
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const router = useRouter();

  const fetchAdminData = useCallback(async (token: string): Promise<AdminData | null> => {
    try {
      const response = await fetch('/admin/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAdminCache(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error('Ошибка загрузки данных админа:', error);
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (hasCheckedAuth) return;
    setHasCheckedAuth(true);
    setIsLoading(true);

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    const data = await fetchAdminData(token);
    if (data) {
      setAdminData(data);
      setIsAdminAuth(true);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      setAdminCache(null);
      setIsAdminAuth(false);
      setAdminData(null);
    }
    setIsLoading(false);
  }, [fetchAdminData, hasCheckedAuth]);

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