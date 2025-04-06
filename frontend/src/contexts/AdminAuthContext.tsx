// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext } from "react";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";

interface AdminProfile {
  id: number;
  email: string;
  fio: string;
}

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminProfile | null;
  isLoading: boolean;
  isAuthChecked: boolean;
  loginAdmin: (token: string, admin: AdminProfile) => void;
  logoutAdmin: () => void;
  checkAuth: () => Promise<boolean>;
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
  const { setDynamicLoading, setStage } = useLoading();
  const authCheckFailsafeRef = React.useRef<NodeJS.Timeout | null>(null);

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
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

  const loginAdmin = useCallback((token: string, admin: AdminProfile) => {
    console.log('AdminAuthContext: Login successful, saving token and setting admin data');
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(admin));
    setIsAdminAuth(true);
    setAdminData(admin);
    setIsLoading(false); // Reset isLoading after successful login
    setIsAuthChecked(true); // Mark authentication check as complete
    // Move to next stage after successful login
    setStage(LoadingStage.STATIC_CONTENT);
    router.push("/admin-profile");
  }, [router, setStage]);

  const logoutAdmin = useCallback(() => {
    console.log('AdminAuthContext: Logging out admin');
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    setIsAdminAuth(false);
    setAdminData(null);
    setIsLoading(false);
    setIsAuthChecked(false);
    // Reset to authentication stage on logout
    setStage(LoadingStage.AUTHENTICATION);
    router.push("/admin-login");
  }, [router, setStage]);

  const validateToken = useCallback(async () => {
    console.log('AdminAuthContext: Validating admin token');
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      console.log('AdminAuthContext: No token found');
      logoutAdmin();
      setIsAuthChecked(true); // Mark auth check complete even on failure
      setStage(LoadingStage.STATIC_CONTENT);
      return false;
    }

    if (isTokenExpired(token)) {
      console.log('AdminAuthContext: Token is expired');
      logoutAdmin();
      setIsAuthChecked(true); // Mark auth check complete even on failure
      setStage(LoadingStage.STATIC_CONTENT);
      return false;
    }

    // Set failsafe timeout to prevent hanging in auth check
    authCheckFailsafeRef.current = setTimeout(() => {
      console.log('AdminAuthContext: Auth check failsafe triggered');
      setDynamicLoading(false);
      setIsLoading(false);
      logoutAdmin();
      setIsAuthChecked(true);
      setStage(LoadingStage.STATIC_CONTENT);
    }, 5000); // 5 second failsafe

    try {
      console.log('AdminAuthContext: Making admin auth check request');
      setDynamicLoading(true);
      setIsLoading(true);
      
      const response = await apiFetch('/admin/check-auth', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response || !response.success) {
        console.log('AdminAuthContext: Auth check failed');
        setDynamicLoading(false);
        logoutAdmin();
        setIsAuthChecked(true);
        setStage(LoadingStage.STATIC_CONTENT);
        return false;
      }
      
      console.log('AdminAuthContext: Auth check successful');
      const data = {
        id: response.data.id,
        email: response.data.email,
        fio: response.data.fio || "Администратор"
      };
      
      // Update stored data with fresh data
      localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
      setAdminData(data);
      setIsAdminAuth(true);
      setDynamicLoading(false);
      setIsAuthChecked(true);
      setStage(LoadingStage.STATIC_CONTENT);
      return true;
    } catch (error) {
      console.error('AdminAuthContext: Error validating token:', error);
      setDynamicLoading(false);
      logoutAdmin();
      // Still mark authentication check as complete, even on failure
      setIsAuthChecked(true);
      setStage(LoadingStage.STATIC_CONTENT);
      return false;
    } finally {
      setIsLoading(false);
      // Clear failsafe if it still exists
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
    }
  }, [logoutAdmin, setDynamicLoading, setStage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log('AdminAuthContext: Initializing auth check');
      // Change to authentication stage before validation
      setStage(LoadingStage.AUTHENTICATION);
      if (localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)) {
        console.log('AdminAuthContext: Token found in localStorage, validating');
        validateToken();
      } else {
        console.log('AdminAuthContext: No token found in localStorage');
        // Mark auth check complete if no token
        setIsAuthChecked(true);
        setStage(LoadingStage.STATIC_CONTENT);
        setIsLoading(false);
        if (!isAdminAuth && window.location.pathname.startsWith("/admin")) {
          router.push("/admin-login");
        }
      }
    }
    
    return () => {
      // Clear failsafe timeout on unmount
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
    };
  }, [validateToken, isAdminAuth, router, setStage]);

  const contextValue = React.useMemo(() => ({
    isAdminAuth,
    adminData,
    isLoading,
    isAuthChecked,
    loginAdmin,
    logoutAdmin,
    checkAuth: validateToken,
  }), [isAdminAuth, adminData, isLoading, isAuthChecked, loginAdmin, logoutAdmin, validateToken]);

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