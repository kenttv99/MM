// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from "react";
import { AdminProfile } from "@/types/index";
import { useLoading } from "@/contexts/LoadingContext"; 

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminProfile | null;
  isCheckingAuth: boolean;
  checkAuth: () => Promise<boolean>;
  logoutAdmin: () => void;
  requireAuth: () => Promise<boolean>;
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
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);
  
  const router = useRouter();
  const { setLoading } = useLoading();
  
  // Use ref to track authentication check promise
  const authCheckPromise = useRef<Promise<boolean> | null>(null);
  const initialized = useRef(false);

  // Fast synchronous check for token at initialization
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
      } catch {
        // Invalid data in storage, will be handled by checkAuth
      }
    }
    
    // Safety timeout to reset checking state if it gets stuck
    const timeout = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, []);

  // Main authentication check function
  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Return existing promise to prevent duplicate requests
    if (authCheckPromise.current) {
      return authCheckPromise.current;
    }
    
    setIsCheckingAuth(true);
    
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

  // Helper to require authentication for protected pages
  const requireAuth = useCallback(async (): Promise<boolean> => {
    // If already authenticated, return immediately
    if (isAdminAuth && !isCheckingAuth) {
      return true;
    }
    
    // If checking, wait for it to complete
    if (isCheckingAuth) {
      try {
        const result = await authCheckPromise.current;
        if (!result) {
          router.push("/admin-login");
          return false;
        }
        return true;
      } catch {
        router.push("/admin-login");
        return false;
      }
    }
    
    // Need to perform a check
    try {
      setLoading(true);
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        router.push("/admin-login");
        return false;
      }
      return true;
    } catch {
      router.push("/admin-login");
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAdminAuth, isCheckingAuth, checkAuth, router, setLoading]);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    router.push("/admin-login");
  }, [router]);

  // Context value with all required properties
  const contextValue = React.useMemo(() => ({
    isAdminAuth,
    adminData,
    isCheckingAuth,
    checkAuth,
    logoutAdmin,
    requireAuth
  }), [isAdminAuth, adminData, isCheckingAuth, checkAuth, logoutAdmin, requireAuth]);

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