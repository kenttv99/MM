// frontend/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "@/utils/api";
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
  updateUserData: (data: UserData) => void;
  handleLoginSuccess: (token: string, user: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecked, setIsAuthCheckedState] = useState(false);
  const isMounted = useRef(true);
  const lastCheckTime = useRef<number>(0);
  const CHECK_INTERVAL = 5000;
  const tokenRef = useRef<string | null>(null);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    // Очистить кэш аватарок
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cached_avatar_url');
      localStorage.removeItem('avatar_cache_buster');
    }
    tokenRef.current = null;
    if (isMounted.current) {
        setIsAuthenticated(false);
        setUser(null);
    }
    authLogger.warn('Authentication failure triggered, clearing tokens and local state.');
  }, []);

  const updateUserData = useCallback((data: UserData) => {
    if (!isMounted.current) return;
    
    authLogger.info('Обновление данных пользователя:', { 
      id: data.id,
      fio: data.fio,
      avatarUrl: data.avatar_url
    });
    
    const wasAvatarRemoved = user && user.avatar_url && !data.avatar_url;
    if (wasAvatarRemoved) {
      authLogger.info('Avatar was removed, updating localStorage and creating cache busters');
      localStorage.setItem('avatar_cache_buster', Date.now().toString());
    }
    setUser(data);
    localStorage.setItem('userData', JSON.stringify(data));
    const event = new CustomEvent('userDataChanged', {
      detail: {
        userData: data,
        avatarRemoved: wasAvatarRemoved
      }
    });
    window.dispatchEvent(event);
    authLogger.info('Dispatched userDataChanged event with updated avatar');
  }, [user]);

  const performInitialAuthCheck = useCallback(async () => {
    authLogger.info('Starting initial authentication check logic');
    let checkSuccessful = false;
    let token = null;
    try {
      token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      tokenRef.current = token;
      if (!token) {
        authLogger.info('No token found, clearing auth state');
        handleAuthFailure();
        checkSuccessful = false;
      } else {
        try {
          const freshUserData = await apiFetch<UserData>('/auth/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            bypassLoadingStageCheck: true
          });
          authLogger.info('Initial auth check successful.', { userId: freshUserData.id });
          if (isMounted.current) {
            setUser(freshUserData);
            setIsAuthenticated(true);
            localStorage.setItem('userData', JSON.stringify(freshUserData));
          }
          checkSuccessful = true;
        } catch (err) {
          authLogger.warn('Token validation failed, clearing auth state.', err);
          handleAuthFailure();
        }
      }
    } catch (error) {
      authLogger.error('Network or other error during initial authentication check:', error);
      handleAuthFailure();
      setIsAuthenticated(false);
      setUser(null);
      checkSuccessful = false;
    } finally {
      if (isMounted.current) {
         // Явно сбрасываем userData и isAuthenticated, если токен не найден или невалиден
         if (!token || !checkSuccessful) {
           setUser(null);
           setIsAuthenticated(false);
         }
         setIsAuthCheckedState(true);
         authLogger.info('Initial auth check finished.', { checkSuccessful });
         authLogger.info('Transitioning to STATIC_CONTENT stage after initial check.');
         if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-check-complete', {
              detail: { isAuthenticated: checkSuccessful }
            }));
         }
      }
    }
  }, [handleAuthFailure, updateUserData, isAuthenticated]);

  // Отключаем правило ESLint для этого useEffect, так как он должен выполняться только при монтировании
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    isMounted.current = true;
    authLogger.info('AuthProvider mounted, starting initial auth check.');

    performInitialAuthCheck();

    // Добавляем обработчик события auth-unauthorized
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent;
      authLogger.warn('Received auth-unauthorized event, updating auth state', customEvent.detail);

      if (isMounted.current) {
        setIsAuthCheckedState(true);

        if (customEvent.detail?.isLoginAttempt) {
          authLogger.info('Login attempt failed, keeping current auth state');
        } else {
          authLogger.info('Unauthorized event (not login attempt), calling logout...');
          logout();
        }
      }
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);

    return () => {
      isMounted.current = false;
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
      authLogger.info('AuthProvider unmounted.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = useCallback((token: string, userData: UserData) => {
    authLogger.info('Handling login success with token and user data');
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    setUser(userData);
    setIsAuthenticated(true);
    setIsAuthCheckedState(true);
    tokenRef.current = token;
    
    if (typeof window !== 'undefined') {
      authLogger.info('Dispatching auth state changed event');
      window.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { isAuth: true, userData, token }
      }));
    }
    
    authLogger.info('Transitioning to STATIC_CONTENT stage after login success');

    return true;
  }, []);

  const logout = useCallback(async () => {
    authLogger.info("Logout initiated.");
    const token = localStorage.getItem('token');

    handleAuthFailure();

    if (isMounted.current) {
        setIsAuthenticated(false);
        setUser(null);
        setIsAuthCheckedState(true);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { isAuth: false, userData: null, token: null }
        }));
        window.dispatchEvent(new CustomEvent('auth-check-complete', {
            detail: { isAuthenticated: false }
        }));
        authLogger.info('Dispatched authStateChanged and auth-check-complete events.');
    }

    if (token) {
        try {
            await apiFetch('/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            authLogger.info("Server logout endpoint called successfully.");
        } catch (error) {
            authLogger.warn("Failed to call server logout endpoint (or endpoint doesn't exist):", error);
        }
    }
  }, [handleAuthFailure]);

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
  
  useEffect(() => {
    const handleUnauthorized = (event: CustomEvent) => {
      authLogger.warn('Detected 401 Unauthorized', event.detail);
      const isLoginAttempt = event.detail?.isLoginAttempt;
      if (isLoginAttempt) {
        authLogger.info('Login attempt failed, marking auth check complete');
        if (isMounted.current) {
          setIsAuthCheckedState(true);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-check-complete', { detail: { isAuthenticated: false } }));
        }
        return;
      }
      authLogger.info('Unauthorized response, forcing logout');
      logout();
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized as EventListener);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized as EventListener);
    };
  }, [isAuthenticated, logout]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (!isMounted.current) return false;
    authLogger.debug('checkAuth called');

    const now = Date.now();
    if (isAuthenticated && (now - lastCheckTime.current < CHECK_INTERVAL)) {
      authLogger.debug('checkAuth skipped due to interval');
      return true;
    }

    const token = tokenRef.current || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    lastCheckTime.current = now;

    if (!token) {
      authLogger.info('checkAuth: No token found.');
      if (isAuthenticated) {
        authLogger.warn('checkAuth: Token missing, logging out.');
        logout();
      }
      return false;
    }

    try {
      authLogger.info('checkAuth: Verifying token with server.');
      await apiFetch<UserData>("/auth/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
        bypassLoadingStageCheck: true
      });
      authLogger.info('checkAuth: Token verification successful.');
      if (!isAuthenticated && isMounted.current) {
         authLogger.warn('checkAuth: Re-fetching user data after successful verification but state mismatch.');
         await performInitialAuthCheck();
      }
      return true;
    } catch (error) {
      authLogger.error("checkAuth: Error verifying token:", error);
      await logout();
      return false;
    }
  }, [isAuthenticated, logout, performInitialAuthCheck]);

  const contextValue = useMemo(() => ({
    isAuth: isAuthenticated,
    userData: user,
    isLoading: !isAuthChecked,
    isAuthChecked,
    checkAuth,
    updateUserData,
    handleLoginSuccess,
    logout
  }), [isAuthenticated, user, isAuthChecked, checkAuth, updateUserData, handleLoginSuccess, logout]);

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