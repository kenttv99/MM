"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";

interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  avatar_url?: string;
}

interface AuthContextType {
  isAuth: boolean;
  userData: UserData | null;
  setIsAuth: (auth: boolean) => void;
  checkAuth: () => Promise<boolean>;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to store and retrieve cached user data
const getUserCache = () => {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem('user_data');
  return cached ? JSON.parse(cached) : null;
};

const setUserCache = (data: UserData | null) => {
  if (typeof window === 'undefined') return;
  if (data) {
    localStorage.setItem('user_data', JSON.stringify(data));
  } else {
    localStorage.removeItem('user_data');
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastCheckRef = useRef<number>(0);
  const checkInProgressRef = useRef<Promise<boolean> | null>(null);
  const backoffTimeRef = useRef<number>(1000); // Start with 1 second backoff

  // Initialize from cache if available
  useEffect(() => {
    const cachedUser = getUserCache();
    if (cachedUser) {
      setUserData(cachedUser);
      setIsAuth(true);
    }
  }, []);

  // Logout function to clear all auth state
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUserCache(null);
    setIsAuth(false);
    setUserData(null);
    window.dispatchEvent(new Event("auth-change"));
  }, []);

  // Throttled checkAuth with better caching and backoff strategy
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckRef.current;
    
    // If a check is already in progress, return the existing promise
    if (checkInProgressRef.current) {
      return checkInProgressRef.current;
    }
    
    // Throttle to at most once every 15 seconds unless forced
    // If we have user data and a token, don't check as frequently
    const throttleTime = (userData && localStorage.getItem("token")) ? 30000 : 15000; // 30 or 15 seconds
    if (timeSinceLastCheck < throttleTime && lastCheckRef.current !== 0) {
      return isAuth; // Return current auth state without checking
    }
    
    // Set loading only on initial load to prevent flickering
    if (lastCheckRef.current === 0) {
      setIsLoading(true);
    }
    
    lastCheckRef.current = now;
    
    const checkPromise = new Promise<boolean>(async (resolve) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsAuth(false);
          setUserData(null);
          setUserCache(null);
          setIsLoading(false);
          resolve(false);
          return;
        }
        
        // Use relative URL to avoid cross-origin issues
        const response = await fetch("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUserData(userData);
          setUserCache(userData);
          setIsAuth(true);
          backoffTimeRef.current = 1000; // Reset backoff on success
          resolve(true);
        } else if (response.status === 429) {
          // If rate limited, use cached data and implement exponential backoff
          console.warn(`Auth check rate limited, backing off for ${backoffTimeRef.current}ms`);
          
          // Increase backoff time for next attempt (exponential backoff)
          backoffTimeRef.current = Math.min(backoffTimeRef.current * 2, 60000); // Max 1 minute
          
          // Don't change auth state on rate limit
          resolve(isAuth);
        } else {
          // Auth failed - clear everything
          localStorage.removeItem("token");
          setUserCache(null);
          setIsAuth(false);
          setUserData(null);
          resolve(false);
        }
      } catch (error) {
        console.error("Ошибка проверки авторизации:", error);
        // Don't change auth state on network errors
        resolve(isAuth);
      } finally {
        setIsLoading(false);
        checkInProgressRef.current = null;
      }
    });
    
    checkInProgressRef.current = checkPromise;
    return checkPromise;
  }, [isAuth, userData]);

  useEffect(() => {
    // Initial auth check
    checkAuth();

    // Global event listener for authentication changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") {
        checkAuth();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    // Custom event for auth changes within the same window
    const handleAuthChange = () => checkAuth();
    window.addEventListener("auth-change", handleAuthChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, [checkAuth]);

  const contextValue = {
    isAuth, 
    userData,
    setIsAuth, 
    checkAuth, 
    isLoading,
    logout
  };

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