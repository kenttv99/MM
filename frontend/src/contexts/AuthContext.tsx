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
      }, 5000);
      
      try {
        // Get token from localStorage and store in ref for faster access
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        tokenRef.current = token;
        
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
        
        // Try to get user data from localStorage first
        const storedUserData = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
        if (storedUserData) {
          try {
            const parsedUserData = JSON.parse(storedUserData);
            console.log('AuthContext: Found user data in localStorage');
            setUser(parsedUserData);
            setIsAuthenticated(true);
            setIsAuthCheckedState(true);
            hasInitialized.current = true;
            console.log('AuthContext: Transitioning to STATIC_CONTENT stage (from localStorage)');
            setStage(LoadingStage.STATIC_CONTENT);
            
            // Still verify with server in background
            verifyWithServer(token);
            return;
          } catch (e) {
            console.error('AuthContext: Error parsing stored user data', e);
            localStorage.removeItem('userData');
          }
        }
        
        // Make the auth check request
        await verifyWithServer(token);
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

    // Helper function to verify token with server
    const verifyWithServer = async (token: string) => {
      console.log('AuthContext: Verifying authentication with token');
      const response = await fetch('/auth/me', {
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
          // Store user data in localStorage for faster retrieval on next load
          if (typeof window !== 'undefined') {
            localStorage.setItem('userData', JSON.stringify(data));
          }
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
          // Clear invalid token and user data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
          }
          // Переходим к следующей стадии загрузки и явно логируем переход
          console.log('AuthContext: Transitioning to STATIC_CONTENT stage (failed)');
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

  const handleLoginSuccess = useCallback((token: string, userData: any) => {
    console.log('AuthContext: Login success, updating state with token and user data');
    
    // Update authentication state
    setIsAuthenticated(true);
    setUser(userData);
    
    // Store token and user data in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    tokenRef.current = token;
    
    // Force a re-render by updating a ref
    hasInitialized.current = true;
    
    // Dispatch custom event to notify components about auth state change
    const event = new CustomEvent('authStateChanged', {
      detail: {
        isAuth: true,
        userData,
        token
      }
    });
    window.dispatchEvent(event);
    
    console.log('AuthContext: Authentication state updated successfully');
  }, []);

  const logout = useCallback(async () => {
    console.log('AuthContext: Starting logout process');
    
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
        console.log('AuthContext: Setting stage to AUTHENTICATION after logout');
        setStage(LoadingStage.AUTHENTICATION);
      } else {
        console.log('AuthContext: Skipping stage update due to admin context');
      }

      // Notify that logout is complete
      window.dispatchEvent(new CustomEvent('auth-logout-complete'));
      
    } catch (error) {
      console.error('AuthContext: Error during logout:', error);
      // Still perform state cleanup on error
      batchUpdate();
    }
  }, [setStage]);

  // Add event listener for admin logout to sync states
  useEffect(() => {
    const handleAdminLogout = () => {
      console.log('AuthContext: Detected admin logout, syncing state');
      if (isAuthenticated) {
        logout();
      }
    };

    window.addEventListener('admin-logout', handleAdminLogout);
    return () => {
      window.removeEventListener('admin-logout', handleAdminLogout);
    };
  }, [isAuthenticated, logout]);

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
        console.log('AuthContext: No token - moving to STATIC_CONTENT');
        setStage(LoadingStage.STATIC_CONTENT);
      }
      return false;
    }

    try {
      console.log('AuthContext: Verifying authentication');
      setStage(LoadingStage.AUTHENTICATION);
      setDynamicLoading(true);
      
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
      }
      
      authCheckFailsafeRef.current = setTimeout(() => {
        if (isMounted.current) {
          console.log('AuthContext: Failsafe triggered - explicitly moving to STATIC_CONTENT');
          setDynamicLoading(false);
          setIsAuthCheckedState(true);
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }, 5000);
      
      const response = await apiFetch<UserData>("/auth/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (authCheckFailsafeRef.current) {
        clearTimeout(authCheckFailsafeRef.current);
        authCheckFailsafeRef.current = null;
      }
      
      if ('aborted' in response) {
        console.error('AuthContext: Request aborted', response.reason);
        console.log('AuthContext: Request aborted - explicitly moving to STATIC_CONTENT');
        setStage(LoadingStage.STATIC_CONTENT);
        throw new Error(response.reason || "Request was aborted");
      }
      
      if ('error' in response) {
        console.error('AuthContext: API error:', response.error);
        console.log('AuthContext: API error - explicitly moving to STATIC_CONTENT');
        setStage(LoadingStage.STATIC_CONTENT);
        throw new Error(typeof response.error === 'string' ? response.error : 'API Error');
      }
      
      console.log('AuthContext: Authentication verified successfully');
      setIsAuthenticated(true);
      setIsAuthCheckedState(true);
      setUser(response);
      
      // Update localStorage with fresh user data
      if (typeof window !== "undefined") {
        localStorage.setItem("userData", JSON.stringify(response));
      }
      
      setDynamicLoading(false);
      console.log('AuthContext: Authentication success - explicitly moving to STATIC_CONTENT');
      setStage(LoadingStage.STATIC_CONTENT);
      return true;
    } catch (error) {
      console.error("AuthContext: Error checking auth:", error);
      if (isMounted.current) {
        logout();
        setDynamicLoading(false);
      }
      setIsAuthCheckedState(true);
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