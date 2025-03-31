// Modifications to frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from "react";
import { AdminProfile } from "@/types/index";
import { usePageLoad } from "@/contexts/PageLoadContext"; // Add PageLoad context

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
  const { setPageLoading } = usePageLoad(); // Use page load context

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
      
      // Ensure page loading is reset
      setPageLoading(false);
      return false;
    }

    try {
      const parsedData: AdminProfile = JSON.parse(cachedData);
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
      
      // Ensure page loading is reset
      setPageLoading(false);
      return false;
    }
  }, [setPageLoading]);

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
    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn("AdminAuthContext: Force resetting loading state after timeout");
        setIsLoading(false);
        // Also ensure page loading is reset
        setPageLoading(false);
        isChecking.current = false;
      }
    }, 5000);
    
    if (!hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      checkAuth().catch((err) => {
        console.error("Initial checkAuth failed:", err);
        // Ensure loading states are reset on error
        setIsLoading(false);
        setPageLoading(false);
        isChecking.current = false;
      });
    }
    
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