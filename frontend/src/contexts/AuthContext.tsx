// frontend/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from "react";
import { apiFetch } from "@/utils/api";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";

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
  const { setDynamicLoading, setStage } = useLoading();
  const isMounted = useRef(true);
  const isInitialized = useRef(false);
  const hasInitialized = useRef(false);
  const lastCheckTime = useRef<number>(0);
  const CHECK_INTERVAL = 5000;
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authCheckFailsafeRef = useRef<NodeJS.Timeout | null>(null);

  // Effect for authentication check
  useEffect(() => {
    if (isInitialized.current) {
      return;
    }
    
    isInitialized.current = true;
    isMounted.current = true;
    
    const checkAuth = async () => {
      if (!isMounted.current) return;

      console.log('AuthContext: Starting initial authentication check');
      
      // Clear previous failsafe
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
      
      // Set failsafe to prevent hanging in auth check
      authCheckFailsafeRef.current = setTimeout(() => {
        if (!isMounted.current) return;
        
        if (!hasInitialized.current) {
          console.log('AuthContext: Auth check failsafe triggered');
          setIsAuthenticated(false);
          setIsAuthCheckedState(true);
          setUser(null);
          hasInitialized.current = true;
          setDynamicLoading(false);
          // Переходим к следующей стадии загрузки и явно логируем переход
          console.log('AuthContext: Transitioning to STATIC_CONTENT stage (failsafe)');
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }, 5000); // 5 second failsafe
      
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        if (!token) {
          console.log('AuthContext: No token found');
          if (isMounted.current) {
            setIsAuthenticated(false);
            setIsAuthCheckedState(true);
            setUser(null);
            hasInitialized.current = true;
            // Переходим к следующей стадии загрузки и явно логируем переход
            console.log('AuthContext: Transitioning to STATIC_CONTENT stage (no token)');
            setStage(LoadingStage.STATIC_CONTENT);
          }
          return;
        }
        
        // Make the auth check request
        console.log('AuthContext: Verifying authentication with token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          console.log('AuthContext: Auth check successful');
          const data = await response.json();
          if (isMounted.current) {
            setUser(data);
            setIsAuthenticated(true);
            setIsAuthCheckedState(true);
            hasInitialized.current = true;
            // Переходим к следующей стадии загрузки и явно логируем переход
            console.log('AuthContext: Transitioning to STATIC_CONTENT stage (success)');
            setStage(LoadingStage.STATIC_CONTENT);
          }
        } else {
          console.log('AuthContext: Auth check failed with status', response.status);
          if (isMounted.current) {
            setUser(null);
            setIsAuthenticated(false);
            setIsAuthCheckedState(true);
            hasInitialized.current = true;
            // Переходим к следующей стадии загрузки и явно логируем переход
            console.log('AuthContext: Transitioning to STATIC_CONTENT stage (failed)');
            setStage(LoadingStage.STATIC_CONTENT);
          }
        }
      } catch (error) {
        console.error('AuthContext: Error during authentication check:', error);
        
        if (!isMounted.current) return;
        
        setUser(null);
        setIsAuthenticated(false);
        setIsAuthCheckedState(true);
        hasInitialized.current = true;
        // Переходим к следующей стадии загрузки и явно логируем переход
        console.log('AuthContext: Transitioning to STATIC_CONTENT stage (error)');
        setStage(LoadingStage.STATIC_CONTENT);
      } finally {
        // Clear failsafe timeout
        if (authCheckFailsafeRef.current) {
          clearTimeout(authCheckFailsafeRef.current);
          authCheckFailsafeRef.current = null;
        }
        
        if (isMounted.current) {
          console.log('AuthContext: Finalizing authentication check');
          setDynamicLoading(false);
          // Переходим к следующей стадии загрузки и явно логируем переход
          console.log('AuthContext: Ensuring transition to STATIC_CONTENT stage (final)');
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted.current = false;
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
      }
    };
  }, [setDynamicLoading, setStage]);

  const updateUserData = useCallback((data: UserData, resetLoading = true) => {
    if (!isMounted.current) return;
    
    setUser(data);
    if (resetLoading) {
      setIsAuthenticated(false);
    }
  }, []);

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    if (!isMounted.current) return;
    
    console.log('AuthContext: Login successful');
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
    setIsAuthenticated(true);
    setIsAuthCheckedState(true);
    setUser(user);
    // Move to next stage after successful login
    setStage(LoadingStage.STATIC_CONTENT);
  }, [setStage]);

  const logout = useCallback(() => {
    if (!isMounted.current) return;
    
    console.log('AuthContext: Logging out user');
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    setIsAuthenticated(false);
    setIsAuthCheckedState(false);
    setUser(null);
    // Reset to authentication stage on logout
    setStage(LoadingStage.AUTHENTICATION);
  }, [setStage]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (!isMounted.current) return false;
    
    const now = Date.now();
    if (now - lastCheckTime.current < CHECK_INTERVAL) {
      return isAuthenticated;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    lastCheckTime.current = now;

    if (!token) {
      if (isMounted.current) {
        setIsAuthenticated(false);
        setIsAuthCheckedState(true);
        setUser(null);
        // Явно переходим к STATIC_CONTENT при отсутствии токена
        console.log('AuthContext: No token - moving to STATIC_CONTENT');
        setStage(LoadingStage.STATIC_CONTENT);
      }
      return false;
    }

    try {
      console.log('AuthContext: Verifying authentication');
      // Set to authentication stage during check
      setStage(LoadingStage.AUTHENTICATION);
      setDynamicLoading(true);
      
      // Set failsafe timeout to prevent hanging in authentication stage
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
      }
      
      authCheckFailsafeRef.current = setTimeout(() => {
        if (isMounted.current) {
          console.log('AuthContext: Failsafe triggered - explicitly moving to STATIC_CONTENT');
          setDynamicLoading(false);
          setIsAuthCheckedState(true);
          // Явно переходим к следующей стадии при срабатывании таймаута
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }, 5000); // 5 second failsafe
      
      const data = await apiFetch<UserData>("/user_edits/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      // Clear failsafe timeout
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
      
      if ('aborted' in data) {
        console.error('AuthContext: Request aborted', data.reason);
        console.log('AuthContext: Request aborted - explicitly moving to STATIC_CONTENT');
        setStage(LoadingStage.STATIC_CONTENT);
        throw new Error(data.reason || "Request was aborted");
      }
      
      if ('error' in data) {
        console.error('AuthContext: API error:', data.error);
        console.log('AuthContext: API error - explicitly moving to STATIC_CONTENT');
        setStage(LoadingStage.STATIC_CONTENT);
        throw new Error(data.error);
      }
      
      console.log('AuthContext: Authentication verified successfully');
      setIsAuthenticated(true);
      setIsAuthCheckedState(true);
      setUser(data);
      setDynamicLoading(false);
      // Переходим к следующей стадии загрузки с дополнительным логированием
      console.log('AuthContext: Authentication success - explicitly moving to STATIC_CONTENT');
      setStage(LoadingStage.STATIC_CONTENT);
      return true;
    } catch (error) {
      console.error("AuthContext: Error checking auth:", error);
      if (isMounted.current) {
        logout();
        setDynamicLoading(false);
      }
      // Still mark authentication check as complete, even on failure
      setIsAuthCheckedState(true);
      // Переходим к следующей стадии загрузки с дополнительным логированием
      console.log('AuthContext: Auth check error - explicitly moving to STATIC_CONTENT');
      setStage(LoadingStage.STATIC_CONTENT);
      console.error('AuthContext: Error checking authentication', error);
      return false;
    }
  }, [isAuthenticated, logout, setDynamicLoading, setStage]);

  const contextValue = useMemo(() => ({
    isAuth: isAuthenticated,
    userData: user,
    isLoading: !hasInitialized.current,
    isAuthChecked,
    checkAuth,
    updateUserData,
    handleLoginSuccess,
    logout
  }), [isAuthenticated, user, checkAuth, updateUserData, handleLoginSuccess, logout, hasInitialized.current, isAuthChecked]);

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