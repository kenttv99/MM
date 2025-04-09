// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from "react";
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
    console.log('AdminAuthContext: Starting admin logout');
    
    // Batch state updates
    const batchUpdate = () => {
      setIsAdminAuth(false);
      setAdminData(null);
      setIsLoading(false);
      setIsAuthChecked(false);
    };

    try {
      // First, notify that we're starting admin logout
      window.dispatchEvent(new CustomEvent('admin-logout-start'));
      
      // Clear admin storage
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);

      // Batch our state updates
      batchUpdate();

      // Only update loading stage if we're in admin context
      const isInAdminContext = window.location.pathname.startsWith('/admin');
      if (isInAdminContext) {
        console.log('AdminAuthContext: Setting stage to AUTHENTICATION after logout');
        setStage(LoadingStage.AUTHENTICATION);
      } else {
        console.log('AdminAuthContext: Skipping stage update due to non-admin context');
      }

      // Notify about admin logout completion
      window.dispatchEvent(new CustomEvent('admin-logout-complete'));
      
      // Navigate to admin login
      router.push("/admin-login");
    } catch (error) {
      console.error('AdminAuthContext: Error during logout:', error);
      // Still perform state cleanup on error
      batchUpdate();
    }
  }, [router, setStage]);

  // Add listener for main auth logout to sync states
  useEffect(() => {
    const handleMainLogout = () => {
      console.log('AdminAuthContext: Detected main auth logout, syncing state');
      if (isAdminAuth) {
        logoutAdmin();
      }
    };

    window.addEventListener('auth-logout-start', handleMainLogout);
    return () => {
      window.removeEventListener('auth-logout-start', handleMainLogout);
    };
  }, [isAdminAuth, logoutAdmin]);

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
    if (authCheckFailsafeRef.current) {
      clearTimeout(authCheckFailsafeRef.current);
    }
    
    authCheckFailsafeRef.current = setTimeout(() => {
      console.log('AdminAuthContext: Auth check failsafe triggered');
      setDynamicLoading(false);
      setIsLoading(false);
      logoutAdmin();
      setIsAuthChecked(true);
      setStage(LoadingStage.STATIC_CONTENT);
    }, 5000); // 5 second failsafe

    try {
      console.log('AdminAuthContext: Making admin auth check request to /admin/me');
      setDynamicLoading(true);
      setIsLoading(true);
      
      try {
        const response = await apiFetch('/admin/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          bypassLoadingStageCheck: true // Обязательно обходим проверку стадии загрузки
        });
        
        console.log('AdminAuthContext: Response from /admin/me:', response);
        
        if (!response || response.error || (response as any).aborted) {
          console.log('AdminAuthContext: Auth check failed', response);
          setDynamicLoading(false);
          logoutAdmin();
          setIsAuthChecked(true);
          setStage(LoadingStage.STATIC_CONTENT);
          return false;
        }
        
        if (!(response as any).success) {
          console.log('AdminAuthContext: Response missing success flag', response);
          setDynamicLoading(false);
          logoutAdmin();
          setIsAuthChecked(true);
          setStage(LoadingStage.STATIC_CONTENT);
          return false;
        }
        
        console.log('AdminAuthContext: Auth check successful', response);
        const adminData = (response as any).data;
        
        if (!adminData) {
          console.log('AdminAuthContext: Response missing data field', response);
          setDynamicLoading(false);
          logoutAdmin();
          setIsAuthChecked(true);
          setStage(LoadingStage.STATIC_CONTENT);
          return false;
        }
        
        const data = {
          id: adminData.id,
          email: adminData.email,
          fio: adminData.fio || "Администратор"
        };
      
        // Update stored data with fresh data
        localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
        setAdminData(data);
        setIsAdminAuth(true);
        setDynamicLoading(false);
        setIsAuthChecked(true);
        setStage(LoadingStage.STATIC_CONTENT);
        return true;
      } catch (apiError) {
        console.error('AdminAuthContext: API error during token validation:', apiError);
        throw apiError;
      }
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
    if (typeof window === "undefined" || isInitialized.current) {
      return;
    }
    
    isInitialized.current = true;
    isMounted.current = true;
    
    console.log('AdminAuthContext: Initializing auth check');
    // Check if we need to change loading stage
    const currentStage = (window as any).__loading_stage__;
    
    if (currentStage !== LoadingStage.AUTHENTICATION) {
      // Only set authentication stage once if needed
      setStage(LoadingStage.AUTHENTICATION);
    }
    
    if (localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)) {
      console.log('AdminAuthContext: Token found in localStorage, validating');
      validateToken();
    } else {
      console.log('AdminAuthContext: No token found in localStorage');
      // Mark auth check complete if no token
      setIsAuthChecked(true);
      setStage(LoadingStage.STATIC_CONTENT);
      setIsLoading(false);
      if (!isAdminAuth && window.location.pathname.startsWith("/admin") && 
          !window.location.pathname.includes("/admin-login")) {
        router.push("/admin-login");
      }
    }
    
    return () => {
      isMounted.current = false;
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