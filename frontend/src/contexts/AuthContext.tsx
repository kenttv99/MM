// frontend/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useLoading } from "@/contexts/LoadingContext";

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
  checkAuth: () => Promise<boolean>;
  updateUserData: (data: UserData, resetLoading?: boolean) => void;
  handleLoginSuccess: (token: string, user: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuth, setIsAuth] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const lastCheckTime = useRef<number>(0);
  const isMounted = useRef<boolean>(false);
  const authTimeout = useRef<NodeJS.Timeout | null>(null);
  const { setStaticLoading } = useLoading();

  const CHECK_INTERVAL = 5000;

  // Автоматический сброс состояния загрузки через 3 секунды
  useEffect(() => {
    if (isLoading) {
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
      }
      
      authTimeout.current = setTimeout(() => {
        if (isMounted.current) {
          console.log("AuthContext: Auto-resetting loading state after timeout");
          setIsLoading(false);
          setStaticLoading(false);
        }
      }, 3000); // 3 секунды максимум для проверки авторизации
    }
    
    return () => {
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
      }
    };
  }, [isLoading, setStaticLoading]);

  const updateUserData = (data: UserData, resetLoading = true) => {
    setUserData(data);
    if (resetLoading) {
      setIsLoading(false);
      setStaticLoading(false);
    }
  };

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
    setIsAuth(true);
    setUserData(user);
    setIsLoading(false);
    setStaticLoading(false);
  }, [setStaticLoading]);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    setIsAuth(false);
    setUserData(null);
    setIsLoading(false);
    setStaticLoading(false);
  }, [setStaticLoading]);

  const checkAuth = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckTime.current < CHECK_INTERVAL) {
      return isAuth;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    lastCheckTime.current = now;

    if (!token) {
      setIsAuth(false);
      setUserData(null);
      setIsLoading(false);
      setStaticLoading(false);
      return false;
    }

    setIsAuth(true);
    setIsLoading(false);
    setStaticLoading(false);
    return true;
  }, [isAuth, setStaticLoading]);

  useEffect(() => {
    console.log("AuthContext useEffect triggered, hasInitialized:", hasInitialized.current);
    
    // Устанавливаем флаг монтирования
    isMounted.current = true;
    
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // Сначала проверяем авторизацию
      checkAuth().then(() => {
        // После проверки авторизации сбрасываем состояние загрузки
        if (isMounted.current) {
          setIsLoading(false);
          setStaticLoading(false);
        }
      });
    }
    
    // Очистка при размонтировании
    return () => {
      isMounted.current = false;
      if (authTimeout.current) {
        clearTimeout(authTimeout.current);
      }
    };
  }, [checkAuth, setStaticLoading]);

  return (
    <AuthContext.Provider value={{ isAuth, userData, isLoading, checkAuth, updateUserData, handleLoginSuccess, logout }}>
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