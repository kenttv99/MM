// frontend/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "@/utils/api";
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';
import { LoadingStage } from '@/contexts/loading/types';
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecked, setIsAuthCheckedState] = useState(false);
  const { setStage } = useLoadingStage();
  const isMounted = useRef(true);
  const lastCheckTime = useRef<number>(0);
  const CHECK_INTERVAL = 5000;
  const initialAuthCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string | null>(null);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    tokenRef.current = null;
    authLogger.info('Authentication failure triggered, clearing tokens.');
  }, []);

  const updateUserData = useCallback((data: UserData, resetLoading = true) => {
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
    if (resetLoading) {
      setIsAuthenticated(false);
    }

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

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      tokenRef.current = token;

      if (!token) {
        authLogger.info('No token found.');
        setIsAuthenticated(false);
        setUser(null);
        checkSuccessful = false;
      } else {
        const storedUserData = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
        if (storedUserData) {
          try {
            const parsedUserData = JSON.parse(storedUserData) as UserData;
            authLogger.info('User data found in localStorage.', { userId: parsedUserData.id });
            setUser(parsedUserData);
            setIsAuthenticated(true);
            checkSuccessful = true;

            if (!parsedUserData.avatar_url && parsedUserData.id) {
              authLogger.info('Missing avatar in localStorage, verifying in background.');
              fetch('/auth/me', {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              })
                .then(res => res.ok ? res.json() : Promise.reject(res))
                .then((freshUserData: UserData) => {
                  if (freshUserData.avatar_url) {
                    authLogger.info('Background check found avatar, updating state.');
                    if (isMounted.current) {
                      updateUserData(freshUserData, false);
                    }
                  }
                })
                .catch(err => authLogger.warn('Background avatar check failed.', err));
            }
          } catch (e) {
            authLogger.error('Error parsing stored user data, clearing.', e);
            localStorage.removeItem('userData');
            setIsAuthenticated(false);
            setUser(null);
            checkSuccessful = false;
          }
        } else {
          authLogger.info('No user data in localStorage, verifying token with server.');
          const response = await fetch('/auth/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenRef.current}` },
          });

          if (response.ok) {
            const userData = await response.json();
            authLogger.info('Server verification successful.', { userId: userData.id });
            setUser(userData);
            setIsAuthenticated(true);
            localStorage.setItem('userData', JSON.stringify(userData));
            checkSuccessful = true;
          } else {
            if (response.status === 401 || response.status === 403) {
               authLogger.warn('Server verification failed with auth error.', { status: response.status });
               handleAuthFailure();
               setIsAuthenticated(false);
               setUser(null);
               checkSuccessful = false;
            } else {
               authLogger.error('Server verification failed with non-auth error.', { status: response.status });
               checkSuccessful = isAuthenticated;
            }
          }
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
         setIsAuthCheckedState(true);
         authLogger.info('Initial auth check finished.', { checkSuccessful });
         authLogger.info('Transitioning to STATIC_CONTENT stage after initial check.');
         setStage(LoadingStage.STATIC_CONTENT);

         if (initialAuthCheckTimeoutRef.current) {
           clearTimeout(initialAuthCheckTimeoutRef.current);
           initialAuthCheckTimeoutRef.current = null;
         }
         if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-check-complete', {
              detail: { isAuthenticated: checkSuccessful }
            }));
         }
      }
    }
  }, [setStage, handleAuthFailure, updateUserData, isAuthenticated]);

  useEffect(() => {
    isMounted.current = true;
    authLogger.info('AuthProvider mounted, starting initial auth check.');

    performInitialAuthCheck();

    initialAuthCheckTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) { 
        authLogger.warn('Initial auth check timeout! Forcing state and stage.');
        setIsAuthenticated(false);
        setUser(null);
        setIsAuthCheckedState(true);
        setStage(LoadingStage.STATIC_CONTENT);
         if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-check-complete', {
              detail: { isAuthenticated: false, isTimeout: true }
            }));
         }
      }
    }, 7000);

    return () => {
      isMounted.current = false;
      authLogger.info('AuthProvider unmounted.');
      if (initialAuthCheckTimeoutRef.current) {
        clearTimeout(initialAuthCheckTimeoutRef.current);
      }
    };
  }, [performInitialAuthCheck, setStage]);

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
    setStage(LoadingStage.STATIC_CONTENT);

    return true;
  }, [setStage]);

  const logout = useCallback(async () => {
    authLogger.info('Starting logout process');
    
    const batchUpdate = () => {
      setUser(null);
      setIsAuthenticated(false);
      setIsAuthCheckedState(true);
      tokenRef.current = null;
    };

    try {
      window.dispatchEvent(new CustomEvent('auth-logout-start'));
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (token) {
        try {
          await apiFetch('/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            bypassLoadingStageCheck: true
          }).catch(err => {
            authLogger.warn('Error during API logout, proceeding with client-side logout', err);
          });
        } catch (e) {
          authLogger.warn('Exception during API logout, proceeding with client-side logout', e);
        }
      }
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
      }

      batchUpdate();

      authLogger.info('Setting stage to AUTHENTICATION after logout (allowing regression)');
      setStage(LoadingStage.AUTHENTICATION, true);

      window.dispatchEvent(new CustomEvent('auth-logout-complete'));
      
    } catch (error) {
      authLogger.error('Error during logout:', error);
      batchUpdate();
    }
  }, [setStage]);

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
      authLogger.info('Detected 401 Unauthorized response', event.detail);
      if (isAuthenticated) {
        authLogger.info('User was authenticated, initiating logout due to 401.');
        logout();
      } else {
        authLogger.info('User was not authenticated, ensuring clean state after 401.');
         if (isMounted.current) {
            setIsAuthenticated(false);
            setUser(null);
            tokenRef.current = null;
            setIsAuthCheckedState(true);
            setStage(LoadingStage.AUTHENTICATION, true);
         }
      }
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized as EventListener);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized as EventListener);
    };
  }, [isAuthenticated, logout, setStage]);

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