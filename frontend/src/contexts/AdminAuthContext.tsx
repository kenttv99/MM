// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext } from "react";
import { apiFetch } from "@/utils/api";

interface AdminProfile {
  id: number;
  email: string;
  fio: string;
}

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminProfile | null;
  isLoading: boolean;
  loginAdmin: (token: string, admin: AdminProfile) => void;
  logoutAdmin: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ADMIN_TOKEN: "admin_token",
  ADMIN_DATA: "admin_data",
};

function decodeJwt(token: string): { exp?: number } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp < Math.floor(Date.now() / 1000);
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();

  const getInitialAuthState = () => {
    if (typeof window === "undefined") {
      return { isAdminAuth: false, adminData: null };
    }
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    const userData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
    if (token && !isTokenExpired(token) && userData) {
      try {
        const parsedData = JSON.parse(userData) as AdminProfile;
        return { isAdminAuth: true, adminData: parsedData };
      } catch {
        return { isAdminAuth: false, adminData: null };
      }
    }
    return { isAdminAuth: false, adminData: null };
  };

  const initialState = getInitialAuthState();
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(initialState.isAdminAuth);
  const [adminData, setAdminData] = useState<AdminProfile | null>(initialState.adminData);
  const [isLoading, setIsLoading] = useState<boolean>(typeof window !== "undefined" && !!localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN));

  const loginAdmin = useCallback((token: string, admin: AdminProfile) => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(admin));
    setIsAdminAuth(true);
    setAdminData(admin);
    setIsLoading(false); // Сбрасываем isLoading после успешного входа
    router.push("/admin-profile");
  }, [router]);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    setIsLoading(false);
    router.push("/admin-login");
  }, [router]);

  const validateToken = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      logoutAdmin();
      return;
    }

    try {
      const data = await apiFetch<AdminProfile>("/admin/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
      setIsAdminAuth(true);
      setAdminData(data);
    } catch {
      logoutAdmin();
    } finally {
      setIsLoading(false);
    }
  }, [logoutAdmin]);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)) {
      validateToken();
    } else if (!isAdminAuth && window.location.pathname.startsWith("/admin")) {
      router.push("/admin-login");
    }
  }, [validateToken, isAdminAuth, router]);

  const contextValue = React.useMemo(() => ({
    isAdminAuth,
    adminData,
    isLoading,
    loginAdmin,
    logoutAdmin,
  }), [isAdminAuth, adminData, isLoading, loginAdmin, logoutAdmin]);

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return context;
};