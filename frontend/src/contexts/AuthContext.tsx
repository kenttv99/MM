// frontend/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContextLegacy";
import { createLogger } from "@/utils/logger";

// Create a namespace-specific logger
const authLogger = createLogger('AuthContext');

interface UserData {
  id: number;
  email: string;
  fio: string;
  telegram?: string;
  whatsapp?: string;
  avatar_url?: string;
}

interface AuthContextType {
  isAuth: boolean;
  userData: UserData | null;
  isLoading: boolean;
  isAuthChecked: boolean;
  checkAuth: () => Promise<boolean>;
  updateUserData: (data: UserData, resetLoading?: boolean) => void;
  handleLoginSuccess: (token: string, user: UserData) => void;
  logout: () => void;
}

// Define a type for window with loading stage
interface WindowWithLoadingStage extends Window {
  __loading_stage__?: LoadingStage;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecked, setIsAuthCheckedState] = useState(false);
  const { setDynamicLoading, setStage } = useLoading();
  const isMounted = useRef(true);
  const isInitialized = useRef(false);
  const hasInitialized = useRef(false);
  const lastCheckTime = useRef<number>(0);
  const CHECK_INTERVAL = 5000;
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authCheckFailsafeRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Effect for authentication check
  useEffect(() => {
    if (isInitialized.current) {
      return;
    }
    
    isInitialized.current = true;
    isMounted.current = true;
    
    const checkAuth = async () => {
      if (!isMounted.current) return;

      authLogger.info('Starting initial authentication check');
      
      // Clear previous failsafe
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
      
      // Set failsafe to prevent hanging in auth check
      authCheckFailsafeRef.current = setTimeout(() => {
        if (!isMounted.current) return;
        
        if (!hasInitialized.current) {
          authLogger.info('Auth check failsafe triggered');
          setIsAuthenticated(false);
          setIsAuthCheckedState(true);
          setUser(null);
          hasInitialized.current = true;
          setDynamicLoading(false);
          // Переходим к следующей стадии загрузки и явно логируем переход
          authLogger.info('Transitioning to STATIC_CONTENT stage (failsafe)');
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }, 5000);
      
      try {
        // Get token from localStorage and store in ref for faster access
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        tokenRef.current = token;
        
        // Проверяем, находимся ли мы на админской странице
        const isAdminRoute = typeof window !== 'undefined' && 
          localStorage.getItem('is_admin_route') === 'true' && 
          window.location.pathname.startsWith('/admin');
        
        // Если мы на админской странице, пропускаем проверку пользовательского токена
        if (isAdminRoute) {
          authLogger.info('Skipping auth check on admin route');
          setIsAuthCheckedState(true);
          // Проверяем текущую стадию загрузки перед установкой новой
          const currentStage = typeof window !== 'undefined' ? 
            (window as WindowWithLoadingStage).__loading_stage__ : 
            null;
          if (currentStage !== LoadingStage.STATIC_CONTENT) {
            authLogger.info('Transitioning to STATIC_CONTENT stage (admin route)');
            setStage(LoadingStage.STATIC_CONTENT);
          } else {
            authLogger.info('Already in STATIC_CONTENT stage, skipping transition');
          }
          return;
        }

        // Clear any incorrect admin route flag if we're not on an admin page
        if (typeof window !== 'undefined' && 
            localStorage.getItem('is_admin_route') === 'true' && 
            !window.location.pathname.startsWith('/admin')) {
          authLogger.info('Clearing incorrect admin route flag');
          localStorage.removeItem('is_admin_route');
        }
        
        // Если токена нет, завершаем проверку сразу
        if (!token) {
          authLogger.info('No token found');
          if (isMounted.current) {
            setIsAuthenticated(false);
            setIsAuthCheckedState(true);
            setUser(null);
            hasInitialized.current = true;
            // Проверяем текущую стадию загрузки перед установкой новой
            const currentStage = typeof window !== 'undefined' ? 
              (window as WindowWithLoadingStage).__loading_stage__ : 
              null;
            if (currentStage !== LoadingStage.STATIC_CONTENT) {
              authLogger.info('Transitioning to STATIC_CONTENT stage (no token)');
              setStage(LoadingStage.STATIC_CONTENT);
            } else {
              authLogger.info('Already in STATIC_CONTENT stage, skipping transition');
            }
            
            // Явно диспатчим событие об отсутствии аутентификации, чтобы система загрузки могла продолжить
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth-check-complete', {
                detail: { 
                  isAuthenticated: false,
                  hasToken: false
                }
              }));
            }
          }
          return;
        }
        
        // Try to get user data from localStorage first
        const storedUserData = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
        if (storedUserData) {
          try {
            const parsedUserData = JSON.parse(storedUserData);
            authLogger.info('Found user data in localStorage:', parsedUserData);
            
            // Проверка на правильность полей и добавление аватара если отсутствует
            if (parsedUserData && !parsedUserData.avatar_url && parsedUserData.id) {
              authLogger.info('Аватар отсутствует в данных, проверяем API');
              
              // Добавляем запрос на получение актуальных данных в фоне
              fetch('/auth/me', {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              })
                .then(response => response.json())
                .then(updatedUserData => {
                  authLogger.info('Получены обновленные данные пользователя:', updatedUserData);
                  if (updatedUserData && updatedUserData.avatar_url) {
                    authLogger.info('Обновляем аватар пользователя:', updatedUserData.avatar_url);
                    setUser(updatedUserData);
                    localStorage.setItem('userData', JSON.stringify(updatedUserData));
                  }
                })
                .catch(err => authLogger.error('Ошибка получения обновленных данных:', err));
            }
            
            setUser(parsedUserData);
            setIsAuthenticated(true);
            setIsAuthCheckedState(true);
            hasInitialized.current = true;
            
            // Проверяем текущую стадию загрузки перед установкой новой
            const currentStage = typeof window !== 'undefined' ? 
              (window as WindowWithLoadingStage).__loading_stage__ : 
              null;
            if (currentStage !== LoadingStage.STATIC_CONTENT) {
              authLogger.info('Transitioning to STATIC_CONTENT stage (from localStorage)');
              setStage(LoadingStage.STATIC_CONTENT);
            } else {
              authLogger.info('Already in STATIC_CONTENT stage, skipping transition');
            }
            
            // Still verify with server in background
            verifyWithServer();
            return;
          } catch (e) {
            authLogger.error('Error parsing stored user data', e);
            localStorage.removeItem('userData');
          }
        }
        
        // Make the auth check request
        await verifyWithServer();
      } catch (error) {
        authLogger.error('Error during authentication check:', error);
        
        if (!isMounted.current) return;
        
        setUser(null);
        setIsAuthenticated(false);
        setIsAuthCheckedState(true);
        hasInitialized.current = true;
        
        // Проверяем текущую стадию загрузки перед установкой новой
        const currentStage = typeof window !== 'undefined' ? 
          (window as WindowWithLoadingStage).__loading_stage__ : 
          null;
        if (currentStage !== LoadingStage.STATIC_CONTENT) {
          authLogger.info('Transitioning to STATIC_CONTENT stage (error)');
          setStage(LoadingStage.STATIC_CONTENT);
        } else {
          authLogger.info('Already in STATIC_CONTENT stage, skipping transition');
        }
      }
    };

    // Helper function to verify token with server
    const verifyWithServer = async () => {
      try {
        const response = await fetch('/auth/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenRef.current}`,
          },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
          setIsAuthCheckedState(true);
          hasInitialized.current = true;
          // Store user data in localStorage for faster retrieval on next load
          if (typeof window !== 'undefined') {
            localStorage.setItem('userData', JSON.stringify(userData));
          }
          // Переходим к следующей стадии загрузки и явно логируем переход
          authLogger.info('Transitioning to STATIC_CONTENT stage (success)');
          setStage(LoadingStage.STATIC_CONTENT);
        } else {
          authLogger.info('Auth check failed with status', response.status);
          handleAuthFailure();
        }
      } catch (error) {
        authLogger.error('Error during auth verification:', error);
        handleAuthFailure();
      }
    };

    checkAuth();

    // Store a reference to the current timeout for cleanup
    const currentAuthFailsafe = authCheckFailsafeRef.current;
    const currentAuthCheckTimeout = authCheckTimeoutRef.current;

    return () => {
      isMounted.current = false;
      if (currentAuthCheckTimeout) {
        clearTimeout(currentAuthCheckTimeout);
      }
      if (currentAuthFailsafe) {
        clearTimeout(currentAuthFailsafe);
      }
    };
  }, [setDynamicLoading, setStage]);

  // Добавляем эффект для отслеживания неопределенного состояния аутентификации
  useEffect(() => {
    // Если проверка аутентификации уже завершена, ничего не делаем
    if (isAuthChecked) return;
    
    // Если начальная проверка аутентификации "зависла", создаем таймер для автоматического перехода
    const authCheckTimeout = setTimeout(() => {
      if (!isAuthChecked) {
        authLogger.warn('Authentication check timeout reached, forcing progress to STATIC_CONTENT');
        setIsAuthCheckedState(true);
        
        // Переходим к следующей стадии загрузки принудительно
        setStage(LoadingStage.STATIC_CONTENT);
        
        // Явно диспатчим событие о завершении проверки аутентификации
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-check-complete', {
            detail: { 
              isAuthenticated: false,
              isTimeout: true
            }
          }));
        }
      }
    }, 3000); // 3 секунды - разумный таймаут для проверки аутентификации
    
    return () => clearTimeout(authCheckTimeout);
  }, [isAuthChecked, setStage, setIsAuthCheckedState, handleAuthFailure]);

  const updateUserData = useCallback((data: UserData, resetLoading = true) => {
    if (!isMounted.current) return;
    
    authLogger.info('Обновление данных пользователя:', { 
      id: data.id,
      fio: data.fio,
      avatarUrl: data.avatar_url
    });
    
    // Check if avatar was removed (userData had it but new data doesn't)
    const wasAvatarRemoved = user && user.avatar_url && !data.avatar_url;
    if (wasAvatarRemoved) {
      authLogger.info('Avatar was removed, updating localStorage and creating cache busters');
      
      // Create cache buster for avatar URLs
      localStorage.setItem('avatar_cache_buster', Date.now().toString());
    }
    
    setUser(data);
    if (resetLoading) {
      setIsAuthenticated(false);
    }

    // Store updated user data in localStorage
    localStorage.setItem('userData', JSON.stringify(data));
    
    // Dispatch custom event to notify components (like Header) about user data change
    const event = new CustomEvent('userDataChanged', {
      detail: {
        userData: data,
        avatarRemoved: wasAvatarRemoved
      }
    });
    window.dispatchEvent(event);
    authLogger.info('Dispatched userDataChanged event with updated avatar');
  }, [user]);

  const handleLoginSuccess = useCallback((token: string, userData: UserData) => {
    authLogger.info('Handling login success with token and user data');
    
    // Устанавливаем токен в localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    // Обновляем локальное состояние
    setUser(userData);
    setIsAuthenticated(true);
    setIsAuthCheckedState(true);
    hasInitialized.current = true;
    tokenRef.current = token;
    
    // Оповещаем о изменении состояния авторизации
    if (typeof window !== 'undefined') {
      authLogger.info('Dispatching auth state changed event');
      window.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: {
          isAuth: true,
          userData,
          token
        }
      }));
    }
    
    // Если хотим управлять стадией загрузки, устанавливаем её здесь
    authLogger.info('Transitioning to STATIC_CONTENT stage after login success');
    setStage(LoadingStage.STATIC_CONTENT);
    
    // Дополнительная проверка через задержку
    setTimeout(() => {
      // Проверяем текущее состояние
      if (!isAuthenticated) {
        authLogger.info('Re-syncing auth state after timeout');
        setIsAuthenticated(true);
        // Оповещаем повторно, если состояние не обновилось
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: {
              isAuth: true,
              userData,
              token
            }
          }));
        }
      }
    }, 300);
    
    return true;
  }, [setStage, isAuthenticated]);

  const logout = useCallback(async () => {
    authLogger.info('Starting logout process');
    
    // Batch state updates to prevent multiple re-renders
    const batchUpdate = () => {
      setUser(null);
      setIsAuthenticated(false);
      setIsAuthCheckedState(true);
      hasInitialized.current = false;
      tokenRef.current = null;
    };

    try {
      // First, notify that we're starting logout
      window.dispatchEvent(new CustomEvent('auth-logout-start'));
      
      // Если есть endpoint для выхода, отправляем запрос на сервер
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (token) {
        try {
          // Попытка отправить запрос на выход (если есть такой endpoint)
          await apiFetch('/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            bypassLoadingStageCheck: true
          }).catch(err => {
            // Игнорируем ошибки при выходе
            authLogger.warn('Error during API logout, proceeding with client-side logout', err);
          });
        } catch (e) {
          // Игнорируем ошибки при выходе
          authLogger.warn('Exception during API logout, proceeding with client-side logout', e);
        }
      }
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
      }

      // Batch our state updates
      batchUpdate();

      // Only update loading stage if we're not in admin context
      const isInAdminContext = window.location.pathname.startsWith('/admin');
      if (!isInAdminContext) {
        authLogger.info('Setting stage to AUTHENTICATION after logout');
        setStage(LoadingStage.AUTHENTICATION, true);
      } else {
        authLogger.info('Skipping stage update due to admin context');
      }

      // Notify that logout is complete
      window.dispatchEvent(new CustomEvent('auth-logout-complete'));
      
    } catch (error) {
      authLogger.error('Error during logout:', error);
      // Still perform state cleanup on error
      batchUpdate();
    }
  }, [setStage]);

  // Add event listener for admin logout to sync states
  useEffect(() => {
    const handleAdminLogout = () => {
      authLogger.info('Detected admin logout, syncing state');
      if (isAuthenticated) {
        logout();
      }
    };

    window.addEventListener('admin-logout', handleAdminLogout);
    return () => {
      window.removeEventListener('admin-logout', handleAdminLogout);
    };
  }, [isAuthenticated, logout]);
  
  // Add event listener for 401 Unauthorized responses
  useEffect(() => {
    const handleUnauthorized = (event: CustomEvent) => {
      authLogger.info('Detected 401 Unauthorized response', event.detail);
      if (isAuthenticated) {
        authLogger.info('Currently authenticated, performing logout due to 401');
        setIsAuthenticated(false);
        setUser(null);
        
        // Clear stored tokens and data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
        }
        
        tokenRef.current = null;
        setIsAuthCheckedState(true);
        
        // Allow regression to AUTHENTICATION by passing isUnauthorizedResponse=true
        authLogger.info('Setting stage to AUTHENTICATION with isUnauthorizedResponse=true');
        setStage(LoadingStage.AUTHENTICATION, true);
      }
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized as EventListener);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized as EventListener);
    };
  }, [isAuthenticated, setStage, handleAuthFailure]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (!isMounted.current) return false;
    
    const now = Date.now();
    if (now - lastCheckTime.current < CHECK_INTERVAL) {
      return isAuthenticated;
    }

    // Use token from ref if available, otherwise get from localStorage
    const token = tokenRef.current || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (token) {
      tokenRef.current = token;
    }
    
    lastCheckTime.current = now;

    if (!token) {
      if (isMounted.current) {
        setIsAuthenticated(false);
        setIsAuthCheckedState(true);
        setUser(null);
        // Корректируем логику: при отсутствии токена оставаемся в AUTHENTICATION
        // вместо перехода к STATIC_CONTENT
        authLogger.info('No token - staying in AUTHENTICATION stage');
        setStage(LoadingStage.AUTHENTICATION); // <- Меняем на AUTHENTICATION вместо STATIC_CONTENT
      }
      return false;
    }

    try {
      authLogger.info('Verifying authentication');
      // Используем флаг isUnauthorizedResponse=true, так как мы возвращаемся к аутентификации
      setStage(LoadingStage.AUTHENTICATION, true);
      setDynamicLoading(true);
      
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
      }
      
      authCheckFailsafeRef.current = setTimeout(() => {
        if (isMounted.current) {
          authLogger.info('Failsafe triggered - explicitly moving to STATIC_CONTENT');
          setDynamicLoading(false);
          setIsAuthCheckedState(true);
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }, 5000);
      
      const response = await apiFetch<UserData>("/auth/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
        bypassLoadingStageCheck: true
      });
      
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
      
      authLogger.info('Authentication verified successfully');
      setIsAuthenticated(true);
      setIsAuthCheckedState(true);
      setUser(response);
      
      // Update localStorage with fresh user data
      if (typeof window !== "undefined") {
        localStorage.setItem("userData", JSON.stringify(response));
      }
      
      setDynamicLoading(false);
      authLogger.info('Authentication success - explicitly moving to STATIC_CONTENT');
      setStage(LoadingStage.STATIC_CONTENT);
      return true;
    } catch (error) {
      authLogger.error("Error checking auth:", error);
      
      // Check if the error contains a status property indicating 401
      const errorWithStatus = error as { status?: number };
      if (error instanceof Error && 'status' in error && errorWithStatus.status === 401) {
        authLogger.info('401 Unauthorized error detected in error object');
        if (isMounted.current) {
          setIsAuthenticated(false);
          setUser(null);
          
          // Clear stored tokens and data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
          }
          
          tokenRef.current = null;
          setIsAuthCheckedState(true);
          setDynamicLoading(false);
          
          // Allow regression to AUTHENTICATION by passing isUnauthorizedResponse=true
          authLogger.info('Setting stage to AUTHENTICATION with isUnauthorizedResponse=true');
          setStage(LoadingStage.AUTHENTICATION, true);
        }
      } else {
        // For other errors, just reset loading state
        if (isMounted.current) {
          setDynamicLoading(false);
        }
      }
      
      setIsAuthCheckedState(true);
      authLogger.info('Auth check error - explicitly moving to STATIC_CONTENT');
      setStage(LoadingStage.STATIC_CONTENT);
      authLogger.error('Error checking authentication', error);
      return false;
    }
  }, [isAuthenticated, setDynamicLoading, setStage]);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    tokenRef.current = null;
    setIsAuthCheckedState(true);
    authLogger.info('Authentication failed, cleared user data');
    // Добавляем переход к STATIC_CONTENT для продолжения загрузки страницы
    setStage(LoadingStage.STATIC_CONTENT);
  }, [setStage, setIsAuthCheckedState, setIsAuthenticated, setUser]);

  const contextValue = useMemo(() => ({
    isAuth: isAuthenticated,
    userData: user,
    isLoading: !hasInitialized.current,
    isAuthChecked,
    checkAuth,
    updateUserData,
    handleLoginSuccess,
    logout
  }), [isAuthenticated, user, checkAuth, updateUserData, handleLoginSuccess, logout, isAuthChecked]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};