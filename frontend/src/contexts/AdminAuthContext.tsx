// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from "react";
import { AdminProfile } from "@/types/index";
import { usePageLoad } from "@/contexts/PageLoadContext";

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminProfile | null;
  isLoading: boolean;
  isCheckingAuth: boolean;
  checkAuth: () => Promise<boolean>;
  logoutAdmin: () => void;
  updateAdminData: (data: AdminProfile) => void;
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ADMIN_TOKEN: "admin_token",
  ADMIN_DATA: "admin_data",
};

function decodeJwt(token: string) {
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
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);
  
  const router = useRouter();
  const { setPageLoading } = usePageLoad();
  
  // Use refs to track state between renders
  const authCheckPromise = useRef<Promise<boolean> | null>(null);
  const initialized = useRef(false);

  // Fast synchronous check for token at init
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    const userData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
    
    // Quick token validation
    if (token && !isTokenExpired(token) && userData) {
      try {
        setAdminData(JSON.parse(userData));
        setIsAdminAuth(true);
      } catch (e) {
        console.error("Error parsing admin data", e);
      }
    }
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Return existing promise to prevent duplicate requests
    if (authCheckPromise.current) {
      return authCheckPromise.current;
    }
    
    setIsCheckingAuth(true);
    setIsLoading(true); // Set loading state when checking auth
    
    const newPromise = (async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        
        // Fast check - invalid token
        if (!token || isTokenExpired(token)) {
          localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
          setIsAdminAuth(false);
          setAdminData(null);
          return false;
        }
        
        // API validation
        const response = await fetch("/admin/me", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
          },
          cache: "no-store"
        });
        
        if (!response.ok) {
          localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
          setIsAdminAuth(false);
          setAdminData(null);
          return false;
        }
        
        const data = await response.json();
        localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
        setIsAdminAuth(true);
        setAdminData(data);
        return true;
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
        setIsAdminAuth(false);
        setAdminData(null);
        return false;
      } finally {
        setIsCheckingAuth(false);
        setIsLoading(false); // Clear loading state when check is complete
        
        // Clear promise reference after completion
        setTimeout(() => {
          authCheckPromise.current = null;
        }, 0);
      }
    })();
    
    // Store promise reference
    authCheckPromise.current = newPromise;
    return newPromise;
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    if (initialized.current) return;
    
    // Set a safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (isLoading || isCheckingAuth) {
        console.warn("AdminAuthContext: Safety timeout triggered");
        setIsLoading(false);
        setIsCheckingAuth(false);
        setPageLoading(false);
      }
    }, 5000);
    
    return () => clearTimeout(safetyTimeout);
  }, [isLoading, isCheckingAuth, setPageLoading]);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    router.push("/admin-login");
  }, [router]);

  const updateAdminData = useCallback((data: AdminProfile) => {
    setAdminData(data);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
  }, []);

  // Context value with all required properties
  const contextValue = React.useMemo(() => ({
    isAdminAuth,
    adminData,
    isLoading,
    isCheckingAuth,
    checkAuth,
    logoutAdmin,
    updateAdminData
  }), [isAdminAuth, adminData, isLoading, isCheckingAuth, checkAuth, logoutAdmin, updateAdminData]);

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