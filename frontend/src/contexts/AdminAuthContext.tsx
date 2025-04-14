// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from "react";
import { useLoadingStage } from "@/contexts/loading/LoadingStageContext";
import { LoadingStage } from "@/contexts/loading/types";
import { checkAdminSession } from "../utils/eventService";
import { createLogger } from "@/utils/logger";

// Create a namespace-specific logger
const adminAuthLogger = createLogger('AdminAuthContext');

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
  LAST_CHECK_TIME: "admin_last_check_time"
};

// Create context with initial value
const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { setStage } = useLoadingStage();
  const isInitialized = useRef(false);
  const isMounted = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);

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
      adminAuthLogger.error("Error decoding token:", e);
      return null;
    }
  };

  // New function to validate token locally without server calls
  const validateTokenLocally = useCallback((): boolean => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) return false;
      
      const expiry = getTokenExpiration(token);
      if (!expiry) return false;
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      return expiry > now;
    } catch (e) {
      adminAuthLogger.error("Error validating token locally:", e);
      return false;
    }
  }, []);

  // Проверка auth статуса на сервере
  const checkAuth = useCallback(async (forceCheck = false) => {
    setLoading(true);
    try {
      // Проверяем есть ли токен в локальном хранилище
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) {
        adminAuthLogger.info("AdminAuth: No token in localStorage");
        setIsAuthenticated(false);
        setAdminData(null);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
        setIsAuthChecked(true);
        if (forceCheck) {
          // Редирект на страницу логина
          router.push('/admin-login');
        }
        return false;
      }

      // Проверяем авторизацию на сервере
      adminAuthLogger.info("AdminAuth: Checking auth on server");
      const isSessionValid = await checkAdminSession();
      
      if (isSessionValid) {
        adminAuthLogger.info("AdminAuth: Session is valid");
        setIsAuthenticated(true);
        setIsAuthChecked(true);
        return true;
      } else {
        adminAuthLogger.info("AdminAuth: Session is invalid");
        // Очищаем данные сессии
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
        
        setIsAuthenticated(false);
        setIsAuthChecked(true);
        
        if (forceCheck) {
          // Редирект на страницу логина
          router.push('/admin-login');
        }
        return false;
      }
    } catch (error) {
      adminAuthLogger.error("AdminAuth: Error checking auth:", error);
      
      // Проверяем есть ли у ошибки поле status
      interface ErrorWithStatus extends Error {
        status?: number;
      }
      
      if (error instanceof Error && 'status' in error) {
        const status = (error as ErrorWithStatus).status;
        adminAuthLogger.info(`AdminAuth: Auth error with status ${status}`);
        
        // Если ошибка авторизации (401 или 403), выполняем выход
        if (status === 401 || status === 403) {
          adminAuthLogger.info("AdminAuth: Auth failed, logging out");
          localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
          
          setIsAuthenticated(false);
          setIsAuthChecked(true);
          
          // Редиректим на страницу логина
          router.push('/admin-login');
          return false;
        }
      }
      
      // Если произошла другая ошибка, пытаемся использовать локальную валидацию
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (token) {
        // Пытаемся проверить срок действия токена локально
        try {
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const expiryTime = tokenData.exp * 1000; // в миллисекундах
          
          if (Date.now() < expiryTime) {
            adminAuthLogger.info("AdminAuth: Using local token validation as fallback");
            setIsAuthenticated(true);
            setIsAuthChecked(true);
            return true;
          }
        } catch (e) {
          adminAuthLogger.error("AdminAuth: Error in local token validation:", e);
        }
      }
      
      // Если локальная валидация не удалась, очищаем данные
      adminAuthLogger.info("AdminAuth: Auth check failed completely, logging out");
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      
      setIsAuthenticated(false);
      setIsAuthChecked(true);
      
      if (forceCheck) {
        router.push('/admin-login');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const login = useCallback((token: string, userData: AdminProfile) => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(userData));
    
    // Сбрасываем время последней проверки, чтобы принудительно проверить после логина
    localStorage.removeItem(STORAGE_KEYS.LAST_CHECK_TIME);
    
    setIsAuthenticated(true);
    setAdminData(userData);
    // No automatic redirect here - handled by the calling component
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    localStorage.removeItem(STORAGE_KEYS.LAST_CHECK_TIME);
    setIsAuthenticated(false);
    setAdminData(null);
    router.push("/admin-login");
  }, [router]);

  // Оптимизированная инициализация - проверяем только при монтировании
  useEffect(() => {
    // Запускаем только один раз при монтировании
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const initAuth = async () => {
      adminAuthLogger.info("AdminAuthContext: Starting authentication initialization");
      setLoading(true);
      
      // Восстанавливаем время последней проверки из локального хранилища
      const storedLastCheckTime = localStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME);
      if (storedLastCheckTime) {
        lastCheckTimeRef.current = parseInt(storedLastCheckTime);
      }
      
      try {
        const isValid = await checkAuth();
        adminAuthLogger.info(`AdminAuthContext: Auth check result: ${isValid}`);
        
        // Устанавливаем стадию STATIC_CONTENT после проверки аутентификации
        // Это предотвращает регрессию к AUTHENTICATION
        setStage(LoadingStage.STATIC_CONTENT);

        // Добавляем обработчик истории для предотвращения лишних рефрешей
        if (typeof window !== 'undefined') {
          // Помечаем как админский маршрут для правильной обработки загрузки
          window.localStorage.setItem('is_admin_route', 'true');
          
          // Отправляем событие об изменении стадии
          const event = new CustomEvent('auth-stage-change', { 
            detail: {
              stage: LoadingStage.STATIC_CONTENT,
              isAdmin: true,
              isAuth: isValid
            }
          });
          window.dispatchEvent(event);
        }
      } catch (err) {
        adminAuthLogger.error("AdminAuthContext: Error during auth initialization:", err);
        // Даже при ошибке разрешаем переход к следующей стадии
        setStage(LoadingStage.STATIC_CONTENT);
      } finally {
        setLoading(false);
        isMounted.current = true;
        adminAuthLogger.info("AdminAuthContext: Initialization complete, loading set to false");
      }
    };

    initAuth();
    
    // Очистка при размонтировании
    return () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('is_admin_route');
      }
    };
  }, [checkAuth, setStage]);

  // Эффект для синхронизации с другими частями приложения через события
  useEffect(() => {
    if (!isMounted.current) return;
    
    // Отправляем событие об изменении стадии для обновления LoadingContext
    if (isAuthChecked) {
      const event = new CustomEvent('auth-stage-change', { 
        detail: {
          stage: LoadingStage.STATIC_CONTENT,
          isAuth: isAuthenticated
        }
      });
      window.dispatchEvent(event);
    }
  }, [isAuthChecked, isAuthenticated]);

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