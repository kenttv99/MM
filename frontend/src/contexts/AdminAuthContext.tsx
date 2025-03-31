// src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from "react";
import { AdminProfile } from "@/types/index";
import { usePageLoad } from "@/contexts/PageLoadContext";

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminProfile | null;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  logoutAdmin: () => void;
  updateAdminData: (data: AdminProfile) => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ADMIN_TOKEN: "admin_token",
  ADMIN_DATA: "admin_data",
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
  const [adminData, setAdminData] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const hasCheckedAuth = useRef(false);
  const isChecking = useRef(false);
  const authCheckPromise = useRef<Promise<boolean> | null>(null);
  const { setPageLoading } = usePageLoad();

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (authCheckPromise.current) {
      return authCheckPromise.current;
    }
    
    authCheckPromise.current = (async () => {
      if (isChecking.current) {
        return isAdminAuth;
      }
      
      isChecking.current = true;
      setIsLoading(true);
      
      try {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        const cachedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);

        if (!token || !cachedData || isTokenExpired(token)) {
          localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
          setIsAdminAuth(false);
          setAdminData(null);
          return false;
        }

        // Проверяем токен на сервере
        const response = await fetch("/admin/me", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
          setIsAdminAuth(false);
          setAdminData(null);
          return false;
        }

        const serverData = await response.json();
        setAdminData(serverData);
        setIsAdminAuth(true);
        localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(serverData));
        return true;
      } catch (err) {
        console.error("Check auth failed:", err);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
        setIsAdminAuth(false);
        setAdminData(null);
        return false;
      } finally {
        setIsLoading(false);
        isChecking.current = false;
        setTimeout(() => {
          authCheckPromise.current = null;
        }, 0);
      }
    })();
    
    return authCheckPromise.current;
  }, [isAdminAuth]);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    router.push("/admin-login", { scroll: false });
  }, [router]);

  const updateAdminData = useCallback((data: AdminProfile) => {
    setAdminData(data);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
  }, []);

  useEffect(() => {
    if (!hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      checkAuth()
        .catch((err) => {
          console.error("Initial checkAuth failed:", err);
          setIsLoading(false);
        })
        .finally(() => {
          setTimeout(() => {
            setIsLoading(false);
            setPageLoading(false);
          }, 0);
        });
    }
    
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn("AdminAuthContext: Force resetting loading state after timeout");
        setIsLoading(false);
        setPageLoading(false);
        isChecking.current = false;
        authCheckPromise.current = null;
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [checkAuth, isLoading, setPageLoading]);

  const contextValue: AdminAuthContextType = {
    isAdminAuth,
    adminData,
    isLoading,
    checkAuth,
    logoutAdmin,
    updateAdminData,
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};