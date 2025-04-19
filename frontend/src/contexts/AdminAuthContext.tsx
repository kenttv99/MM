// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from "react";
import { useLoadingStage } from "@/contexts/loading/LoadingStageContext";
import { useLoadingFlags } from "@/contexts/loading/LoadingFlagsContext";
import { LoadingStage } from "@/contexts/loading/types";
import { checkAdminSession } from "@/utils/eventAdminService";
import { createLogger } from "@/utils/logger";
import { ApiError } from "@/utils/api";

// Create a namespace-specific logger
const adminAuthLogger = createLogger('AdminAuthContext');

interface AdminProfile {
  id: number;
  email: string;
  fio: string;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  adminData: AdminProfile | null;
  login: (token: string, userData: AdminProfile) => void;
  logout: () => void;
  checkAuth: (forceCheck?: boolean) => Promise<boolean>;
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

// Helper function to safely parse admin data from localStorage
const getStoredAdminData = (): AdminProfile | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
    if (data) {
      const parsedData = JSON.parse(data);
      // Basic validation to ensure it looks like AdminProfile
      if (parsedData && typeof parsedData === 'object' && 'id' in parsedData && 'email' in parsedData) {
        return parsedData as AdminProfile;
      }
    }
  } catch (e) {
    adminAuthLogger.error("Error reading admin data from localStorage", e);
  }
  return null;
};

// Helper function to decode token and extract expiration (needed for validation)
const getTokenExpiration = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.exp || null;
  } catch (e) {
    adminAuthLogger.error("Error decoding token:", e);
    return null;
  }
};

// Function to validate token locally (defined before use in initial state)
const validateTokenLocally = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const expiry = getTokenExpiration(token);
    if (!expiry) return false;
    const now = Math.floor(Date.now() / 1000);
    return expiry > now;
  } catch (e) {
    adminAuthLogger.error("Error validating token locally:", e);
    return false;
  }
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { setStage, currentStage } = useLoadingStage();
  const { setStaticLoading } = useLoadingFlags();
  const isInitialized = useRef(false);
  const isMounted = useRef(false);
  const checkingAuthRef = useRef(false);

  // Initialize state with data from localStorage if available and token is valid locally
  const initialToken = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) : null;
  const initialAdminData = initialToken && validateTokenLocally(initialToken) ? getStoredAdminData() : null;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialAdminData);
  const [adminData, setAdminData] = useState<AdminProfile | null>(initialAdminData);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

  // Re-define validateTokenLocally using useCallback inside the provider
  const validateTokenLocallyCallback = useCallback((token: string | null): boolean => {
     return validateTokenLocally(token); // Call the helper function defined outside
  }, []);

  // Проверка auth статуса на сервере
  const checkAuth = useCallback(async (forceCheck = false) => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      // Use the callback version for consistency within useCallback dependencies
      if (!token || !validateTokenLocallyCallback(token)) {
        adminAuthLogger.info("AdminAuth: No valid token in localStorage");
        setIsAuthenticated(false);
        setAdminData(null);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
        setIsAuthChecked(true);
        if (forceCheck) {
          router.push('/admin-login');
        }
        return false;
      }

      // Проверяем авторизацию на сервере и ПОЛУЧАЕМ ПРОФИЛЬ
      adminAuthLogger.info("AdminAuth: Checking auth on server and fetching profile");
      const profile = await checkAdminSession(); // Эта функция теперь возвращает AdminProfile

      // Если профиль получен (сессия валидна)
      adminAuthLogger.info("AdminAuth: Session is valid, profile received");
      setIsAuthenticated(true);
      setAdminData(profile); // Устанавливаем профиль, полученный с сервера
      // Сохраняем актуальный профиль в localStorage
      localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(profile));
      setIsAuthChecked(true);
      return true;
      
    } catch (error) {
      adminAuthLogger.error("AdminAuth: Error checking auth:", error);

      // Если ошибка от checkAdminSession (ApiError с 401/403), данные уже должны быть очищены
      // Нам не нужно их здесь дублировать, checkAdminSession уже это делает

      // Обрабатываем другие возможные ошибки (сетевые и т.д.)
      interface ErrorWithStatus extends Error {
        status?: number;
      }

      if (error instanceof Error && 'status' in error) {
        const status = (error as ErrorWithStatus).status;
        adminAuthLogger.info(`AdminAuth: Auth error with status ${status}`);

        // Логика очистки при 401/403 была в checkAdminSession, здесь не нужна
        // if (status === 401 || status === 403) { ... }
      }

      // Fallback check: Если произошла НЕ auth ошибка (например, сеть недоступна),
      // но токен все еще валиден локально
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!(error instanceof ApiError && (error.status === 401 || error.status === 403)) && 
          validateTokenLocallyCallback(token)) {
          adminAuthLogger.warn("AdminAuth: Server check failed (non-auth error), but token still valid locally. Maintaining auth state.");
          setIsAuthenticated(true); // Keep authenticated state
          // Пытаемся восстановить данные из хранилища в этом случае
          const storedDataForFallback = getStoredAdminData();
          if (storedDataForFallback) {
              setAdminData(currentAdminData => currentAdminData === null ? storedDataForFallback : currentAdminData);
          }
          setIsAuthChecked(true);
          // setLoading(false) вызовется в finally
          return true; // Return true based on local validation
      }

      // Если произошла ошибка (включая 401/403 от checkAdminSession) ИЛИ локальный токен невалиден
      adminAuthLogger.info("AdminAuth: Auth check failed, ensuring logout state");
      // Убедимся, что состояние соответствует выходу (токены уже должны быть удалены checkAdminSession)
      setIsAuthenticated(false);
      setAdminData(null);
      setIsAuthChecked(true);

      // Редирект только если проверка была принудительной
      if (forceCheck) {
        router.push('/admin-login');
      }
      return false;
    }
  }, [router, validateTokenLocallyCallback]);

  const login = useCallback((token: string, userData: AdminProfile) => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(userData));
    localStorage.removeItem(STORAGE_KEYS.LAST_CHECK_TIME);

    setIsAuthenticated(true);
    setAdminData(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
    localStorage.removeItem(STORAGE_KEYS.LAST_CHECK_TIME);
    setIsAuthenticated(false);
    setAdminData(null);
    router.push("/admin-login");
  }, [router]);

  // Инициализация при монтировании
  useEffect(() => {
    if (isInitialized.current || checkingAuthRef.current) return;
    isInitialized.current = true;
    isMounted.current = true;

    const initAuth = async () => {
      if (checkingAuthRef.current) return;
      checkingAuthRef.current = true;
      
      adminAuthLogger.info("AdminAuthContext: Starting authentication initialization");
      
      // --- Устанавливаем флаг и стадию начала аутентификации ТОЛЬКО если мы в начале ---
      setStaticLoading(true); // Флаг ставим всегда при начале проверки
      if (currentStage === LoadingStage.INITIAL) {
        adminAuthLogger.info(`AdminAuthContext: Current stage is INITIAL, setting stage to AUTHENTICATION.`);
        setStage(LoadingStage.AUTHENTICATION);
      } else {
         adminAuthLogger.info(`AdminAuthContext: Current stage is ${currentStage}, skipping setStage(AUTHENTICATION).`);
      }
      // -----------------------------------------------------------------------------

      let checkSuccessful = false;
      try { 
        checkSuccessful = await checkAuth(); // checkAuth теперь только проверяет и устанавливает состояния
        adminAuthLogger.info(`AdminAuthContext: Initial auth check result: ${checkSuccessful}`);
      } catch (e) {
         // Логируем ошибки, не пойманные внутри checkAuth (маловероятно)
         adminAuthLogger.error("AdminAuthContext: Unexpected error during initAuth checkAuth call", e);
         // isAuthChecked все равно установится в true в checkAuth, даже при ошибке
      } finally {
         // --- Устанавливаем стадию и флаг ПОСЛЕ завершения проверки --- 
         if (isMounted.current) {
            // Переходим к STATIC_CONTENT независимо от результата проверки
            setStage(LoadingStage.STATIC_CONTENT);
            setStaticLoading(false); // Сбрасываем флаг статической загрузки
            adminAuthLogger.info("AdminAuthContext: Initialization complete, stage set to STATIC_CONTENT");
            
            // Диспатчим событие для других частей приложения
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('is_admin_route', 'true'); // Этот флаг можно оставить
              const event = new CustomEvent('auth-stage-change', {
                detail: {
                  stage: LoadingStage.STATIC_CONTENT,
                  isAdmin: true,
                  isAuth: checkSuccessful // Используем результат проверки
                }
              });
              window.dispatchEvent(event);
            }
         }
         // ---------------------------------------------------------------
         checkingAuthRef.current = false; // Сбрасываем флаг проверки
      }
    };

    // Запускаем инициализацию
    initAuth();

    // Очистка при размонтировании
    return () => {
      isMounted.current = false;
      // Не сбрасываем isInitialized.current, чтобы эффект не запускался повторно при HMR
    };
  }, [checkAuth, setStage, setStaticLoading, currentStage]);

  // Контекстное значение
  const contextValue = {
    isAuthenticated,
    adminData,
    login,
    logout,
    checkAuth,
    validateTokenLocally: () => validateTokenLocallyCallback(localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)),
    isAuthChecked,
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};