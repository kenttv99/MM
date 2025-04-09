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
    
    // Validate token first
    if (!token || token === "undefined" || token === "null") {
      console.error('AdminAuthContext: Attempted to save invalid token:', token);
      return;
    }
    
    // Set token and data in localStorage
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(admin));
    
    // Update state
    setIsAdminAuth(true);
    setAdminData(admin);
    setIsLoading(false); // Reset isLoading after successful login
    setIsAuthChecked(true); // Mark authentication check as complete
    
    // Move to next stage after successful login
    setStage(LoadingStage.STATIC_CONTENT);
    
    // Short delay before setting COMPLETED to allow stages to settle
    setTimeout(() => {
      setStage(LoadingStage.COMPLETED);
      console.log('AdminAuthContext: Set stage to COMPLETED after login');
      
      // Redirect to admin profile
      router.push("/admin-profile");
    }, 100);
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

  // Проверка токена администратора
  const validateToken = useCallback(async (): Promise<boolean> => {
    // Получаем токен из локального хранилища
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    
    if (!token) {
      console.log('AdminAuthContext: No token found during validation');
      logoutAdmin();
      
      // Set to STATIC_CONTENT instead of COMPLETED for invalid tokens
      setStage(LoadingStage.STATIC_CONTENT);
      setIsLoading(false);
      setIsAuthChecked(true);
      
      return false;
    }
    
    if (isTokenExpired(token)) {
      console.log('AdminAuthContext: Token expired');
      logoutAdmin();
      
      // Set to STATIC_CONTENT instead of COMPLETED for expired tokens
      setStage(LoadingStage.STATIC_CONTENT);
      setIsLoading(false);
      setIsAuthChecked(true);
      
      return false;
    }
    
    console.log('AdminAuthContext: Validating admin token');
    
    // Set to STATIC_CONTENT to allow static content to load while checking auth
    setStage(LoadingStage.STATIC_CONTENT);
    
    // Включаем защитный таймер для предотвращения зависания на проверке авторизации
    authCheckFailsafeRef.current = setTimeout(() => {
      console.log('AdminAuthContext: Auth check timeout, forcing completion');
      setIsLoading(false);
      setDynamicLoading(false);
      setIsAuthChecked(true);
      
      // Принудительно переводим к завершающей стадии 
      setStage(LoadingStage.COMPLETED);
    }, 2000); // 2 секунд вместо 3

    try {
      // Запрос к API
      console.log('AdminAuthContext: Making admin auth check request to /admin/me');
      
      try {
        const response = await apiFetch('/admin/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          bypassLoadingStageCheck: true // Всегда обходим проверку стадии загрузки
        });
        
        console.log('AdminAuthContext: Response from /admin/me:', response);
        
        // Проверка на ошибки в ответе
        if (!response || response.error || (response as any).aborted) {
          console.log('AdminAuthContext: Auth check failed', response);
          logoutAdmin();
          setIsAuthChecked(true);
          setIsLoading(false);
          return false;
        }
        
        // Проверка флага успеха
        if (!(response as any).success) {
          console.log('AdminAuthContext: Response missing success flag', response);
          logoutAdmin();
          setIsAuthChecked(true);
          setIsLoading(false);
          return false;
        }
        
        // Проверка наличия данных
        const adminData = (response as any).data;
        if (!adminData) {
          console.log('AdminAuthContext: Response missing data field', response);
          logoutAdmin();
          setIsAuthChecked(true);
          setIsLoading(false);
          return false;
        }
        
        // Записываем данные администратора
        console.log('AdminAuthContext: Auth check successful', response);
        const data = {
          id: adminData.id,
          email: adminData.email,
          fio: adminData.fio || "Администратор"
        };
      
        // Обновляем локальное хранилище и состояние
        localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
        
        // Устанавливаем состояние
        setAdminData(data);
        setIsAdminAuth(true);
        setIsLoading(false);
        setIsAuthChecked(true);
        
        // Принудительно отключаем все индикаторы загрузки
        setDynamicLoading(false);
        
        // Now move to COMPLETED stage since auth is valid
        setStage(LoadingStage.COMPLETED);
        
        // Устанавливаем флаг для принудительного скрытия спиннеров
        if (typeof window !== 'undefined') {
          (window as any).__admin_auth_complete__ = true;
          // Добавляем DOM-событие для уведомления других компонентов
          window.dispatchEvent(new CustomEvent('admin-auth-complete', { detail: { authenticated: true } }));
        }
        
        return true;
      } catch (apiError) {
        // Обработка ошибок API
        console.error('AdminAuthContext: API error during token validation:', apiError);
        
        // Сразу отключаем спиннеры
        setIsLoading(false);
        setDynamicLoading(false);
        
        // Устанавливаем состояние
        logoutAdmin();
        setIsAuthChecked(true);
        
        return false;
      }
    } catch (error) {
      // Обработка общих ошибок
      console.error('AdminAuthContext: Error validating token:', error);
      
      // Сразу отключаем спиннеры
      setIsLoading(false);
      setDynamicLoading(false);
      
      // Устанавливаем состояние
      logoutAdmin();
      setIsAuthChecked(true);
      
      return false;
    } finally {
      // Очищаем защитный таймер
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
      
      // Гарантированно отключаем все индикаторы загрузки
      setIsLoading(false);
      setDynamicLoading(false);
    }
  }, [logoutAdmin, setDynamicLoading, setStage, setIsLoading]);

  useEffect(() => {
    if (typeof window === "undefined" || isInitialized.current) {
      return;
    }
    
    isInitialized.current = true;
    isMounted.current = true;
    
    console.log('AdminAuthContext: Initializing auth check');
    
    // Set AUTHENTICATION stage instead of COMPLETED
    setStage(LoadingStage.AUTHENTICATION);
    
    if (localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)) {
      console.log('AdminAuthContext: Token found in localStorage, validating');
      // Log the token first few characters for debugging
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (token) {
        console.log('AdminAuthContext: Token preview:', token.substring(0, 10) + '...');
        
        // Check if token is expired
        if (isTokenExpired(token)) {
          console.log('AdminAuthContext: Token is expired, will be removed during validation');
        }
      }
      validateToken();
    } else {
      console.log('AdminAuthContext: No token found in localStorage');
      // Mark auth check complete if no token
      setIsAuthChecked(true);
      setIsLoading(false);
      // Set to STATIC_CONTENT to allow initial content to load
      setStage(LoadingStage.STATIC_CONTENT);
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