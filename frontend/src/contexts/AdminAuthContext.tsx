// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from "react";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { checkAdminSession, handleTokenRefresh } from "../utils/eventService";

// Константы для управления проверкой сессии
const SESSION_CHECK_DEBOUNCE_MS = 120000; // 2 минуты между проверками
const TOKEN_EXPIRY_BUFFER = 300; // 5 минут (в секундах)

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

// Функция для определения приближения к истечению токена
const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload && payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return payload.exp - now < TOKEN_EXPIRY_BUFFER;
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
  const authCheckFailsafeRef = useRef<NodeJS.Timeout | null>(null);
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
      console.error("Error decoding token:", e);
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
      console.error("Error validating token locally:", e);
      return false;
    }
  }, []);

  // Оптимизированная проверка аутентификации с дебаунсингом и интеллектуальным кэшированием
  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Используем локальную валидацию
    if (!validateTokenLocally()) {
      console.log("AdminAuthContext: Token invalid locally");
      setIsAuthenticated(false);
      setAdminData(null);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      setIsAuthChecked(true);
      return false;
    }

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      console.log("AdminAuthContext: No token found");
      setIsAuthenticated(false);
      setIsAuthChecked(true);
      return false;
    }
    
    // Определяем, нужно ли делать запрос на сервер
    const now = Date.now();
    const lastCheckTime = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME) || '0');
    const isTokenNearExpiry = isTokenExpiringSoon(token);
    
    // Пропускаем проверку, если:
    // 1. Токен действителен локально
    // 2. Последняя проверка была недавно (в пределах SESSION_CHECK_DEBOUNCE_MS)
    // 3. Токен не приближается к истечению срока
    if (
      now - lastCheckTime < SESSION_CHECK_DEBOUNCE_MS && 
      !isTokenNearExpiry
    ) {
      console.log("AdminAuthContext: Using cached validation result");
      setIsAuthenticated(true);
      setIsAuthChecked(true);
      
      // Восстанавливаем данные из кэша
      if (!adminData) {
        const storedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
        if (storedData) {
          try {
            setAdminData(JSON.parse(storedData));
          } catch (e) {
            console.error("AdminAuthContext: Error parsing stored admin data");
          }
        }
      }
      
      setLoading(false);
      return true;
    }
    
    // Если нужна проверка на сервере:
    try {
      console.log("AdminAuthContext: Performing server validation");
      
      // Обновляем время последней проверки
      localStorage.setItem(STORAGE_KEYS.LAST_CHECK_TIME, now.toString());
      lastCheckTimeRef.current = now;
      
      // Используем серверную проверку только когда действительно необходимо
      const isValid = await checkAdminSession();
      
      setIsAuthenticated(isValid);
      
      if (!isValid) {
        setAdminData(null);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
      } else if (!adminData) {
        // Восстанавливаем из хранилища, если нет в состоянии
        const storedData = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
        if (storedData) {
          try {
            setAdminData(JSON.parse(storedData));
          } catch (e) {
            console.error("AdminAuthContext: Error parsing stored admin data");
          }
        }
      }
      
      setIsAuthChecked(true);
      return isValid;
    } catch (error) {
      console.error("AdminAuthContext: Error checking authentication:", error);
      
      // В случае ошибки используем локальную валидацию
      const isLocallyValid = validateTokenLocally();
      setIsAuthenticated(isLocallyValid);
      setIsAuthChecked(true);
      
      return isLocallyValid;
    } finally {
      setLoading(false);
    }
  }, [validateTokenLocally, adminData]);

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
      console.log("AdminAuthContext: Starting authentication initialization");
      setLoading(true);
      
      // Восстанавливаем время последней проверки из локального хранилища
      const storedLastCheckTime = localStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME);
      if (storedLastCheckTime) {
        lastCheckTimeRef.current = parseInt(storedLastCheckTime);
      }
      
      try {
        const isValid = await checkAuth();
        console.log(`AdminAuthContext: Auth check result: ${isValid}`);
        
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
        console.error("AdminAuthContext: Error during auth initialization:", err);
        // Даже при ошибке разрешаем переход к следующей стадии
        setStage(LoadingStage.STATIC_CONTENT);
      } finally {
        setLoading(false);
        isMounted.current = true;
        console.log("AdminAuthContext: Initialization complete, loading set to false");
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