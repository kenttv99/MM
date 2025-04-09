// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from "react";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { checkAdminSession } from "../utils/eventService";

interface AdminProfile {
  id: number;
  email: string;
  fio: string;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  adminData: AdminProfile | null;
  login: (token: string, userData: AdminProfile) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  validateTokenLocally: () => boolean;
  isAuthChecked: boolean;
}

// Константы для хранилища
const STORAGE_KEYS = {
  ADMIN_TOKEN: "admin_token",
  ADMIN_DATA: "admin_data",
};

// Вспомогательная функция для проверки истечения срока действия токена
const isTokenExpired = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Проверяем срок действия токена
    if (payload && payload.exp) {
      return payload.exp < Date.now() / 1000;
    }
    return false;
  } catch (e) {
    console.error('AdminAuthContext: Error checking token expiration:', e);
    return true;
  }
};

// Create context with initial value
const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { setDynamicLoading, setStage } = useLoading();
  const authCheckFailsafeRef = React.useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);
  const isMounted = useRef(false);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminData, setAdminData] = useState<AdminProfile | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

  // Helper function to decode token and extract expiration
  const getTokenExpiration = (token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.exp || null;
    } catch (e) {
      console.error("Error decoding token:", e);
      return null;
    }
  };

  // New function to validate token locally without server calls
  const validateTokenLocally = (): boolean => {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) return false;
      
      const expiry = getTokenExpiration(token);
      if (!expiry) return false;
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      return expiry > now;
    } catch (e) {
      console.error("Error validating token locally:", e);
      return false;
    }
  };

  // Check authentication status with the server
  const checkAuth = async (): Promise<boolean> => {
    try {
      // First try to validate locally to avoid unnecessary server calls
      if (!validateTokenLocally()) {
        setIsAuthenticated(false);
        setAdminData(null);
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_data");
        setIsAuthChecked(true);
        return false;
      }
      
      // Use the improved checkAdminSession that minimizes server calls
      const isValid = await checkAdminSession();
      
      setIsAuthenticated(isValid);
      
      if (!isValid) {
        setAdminData(null);
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_data");
      } else if (!adminData) {
        // Restore admin data from local storage if not in state
        const storedData = localStorage.getItem("admin_data");
        if (storedData) {
          setAdminData(JSON.parse(storedData));
        }
      }
      
      setIsAuthChecked(true);
      return isValid;
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsAuthChecked(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = (token: string, userData: AdminProfile) => {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_data", JSON.stringify(userData));
    setIsAuthenticated(true);
    setAdminData(userData);
    // No automatic redirect here - handled by the calling component
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    setIsAuthenticated(false);
    setAdminData(null);
    router.push("/admin-login");
  };

  useEffect(() => {
    // Check authentication status on mount
    const initAuth = async () => {
      console.log("AdminAuthContext: Starting authentication initialization");
      setLoading(true);
      
      // Check if we already have admin data in local storage
      const storedToken = localStorage.getItem("admin_token");
      const storedData = localStorage.getItem("admin_data");
      
      console.log("AdminAuthContext: Stored data check:", {
        hasToken: !!storedToken,
        hasAdminData: !!storedData,
        isMount: isMounted.current
      });
      
      isMounted.current = true;
      
      try {
        const isValid = await checkAuth();
        console.log(`AdminAuthContext: Auth check result: ${isValid}`);
      } catch (err) {
        console.error("AdminAuthContext: Error during auth initialization:", err);
      } finally {
        setLoading(false);
        console.log("AdminAuthContext: Initialization complete, loading set to false");
      }
    };

    initAuth();
  }, []);

  const contextValue = React.useMemo(() => ({
    isAuthenticated,
    loading,
    adminData,
    login,
    logout,
    checkAuth,
    validateTokenLocally,
    isAuthChecked,
  }), [isAuthenticated, loading, adminData, login, logout, checkAuth, validateTokenLocally, isAuthChecked]);

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