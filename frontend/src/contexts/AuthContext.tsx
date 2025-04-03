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
  logout: () => void; // Новый метод
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuth, setIsAuth] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const lastCheckTime = useRef<number>(0);
  const { setLoading } = useLoading();

  const CHECK_INTERVAL = 5000;

  const updateUserData = (data: UserData, resetLoading = true) => {
    setUserData(data);
    if (resetLoading) {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const handleLoginSuccess = useCallback((token: string, user: UserData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
    setIsAuth(true);
    setUserData(user);
    setIsLoading(false);
    setLoading(false);
  }, [setIsAuth, setUserData, setIsLoading, setLoading]);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    setIsAuth(false);
    setUserData(null);
    setIsLoading(false);
    setLoading(false);
  }, [setIsAuth, setUserData, setIsLoading, setLoading]);

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
      setLoading(false);
      return false;
    }

    setIsAuth(true);
    setIsLoading(false);
    setLoading(false);
    return true;
  }, [isAuth, setIsAuth, setUserData, setIsLoading, setLoading]);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      checkAuth();
    }
  }, [checkAuth]);

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