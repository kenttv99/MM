// frontend/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from "react";
import { apiFetch } from "@/utils/api";

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

  const CHECK_INTERVAL = 5000;

  const updateUserData = useCallback((data: UserData, resetLoading = true) => {
    setUserData(data);
    if (resetLoading) {
      setIsLoading(false);
    }
  }, []);

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
    setIsAuth(true);
    setUserData(user);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    setIsAuth(false);
    setUserData(null);
    setIsLoading(false);
  }, []);

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
      return false;
    }

    try {
      const data = await apiFetch<UserData>("/user_edits/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if ('aborted' in data) {
        throw new Error(data.reason || "Request was aborted");
      }
      
      if ('error' in data) {
        throw new Error(data.error);
      }
      
      setIsAuth(true);
      setUserData(data);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error checking auth:", error);
      logout();
      return false;
    }
  }, [isAuth, logout]);

  useEffect(() => {
    console.log("AuthContext useEffect triggered, hasInitialized:", hasInitialized.current);
    
    // Устанавливаем флаг монтирования
    isMounted.current = true;
    
    // Проверяем, не была ли уже выполнена инициализация
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      
      // Проверяем авторизацию сразу
      const checkAuthAndReset = async () => {
        try {
          await checkAuth();
        } catch (error) {
          console.error("AuthContext: Error during auth check:", error);
        } finally {
          // Сбрасываем состояние загрузки только если компонент все еще смонтирован
          if (isMounted.current) {
            // Даем время для завершения статической загрузки
            setTimeout(() => {
              if (isMounted.current) {
                setIsLoading(false);
              }
            }, 100);
          }
        }
      };
      
      checkAuthAndReset();
    }
    
    // Очищаем при размонтировании
    return () => {
      isMounted.current = false;
    };
  }, [checkAuth]);

  const contextValue = useMemo(() => ({
    isAuth,
    userData,
    isLoading,
    checkAuth,
    updateUserData,
    handleLoginSuccess,
    logout
  }), [isAuth, userData, isLoading, checkAuth, updateUserData, handleLoginSuccess, logout]);

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