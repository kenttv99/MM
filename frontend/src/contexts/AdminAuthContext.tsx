// frontend/src/contexts/AdminAuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";

interface AdminData {
  id: number;
  fio: string;
  email: string;
  avatar_url?: string;
}

interface AdminAuthContextType {
  isAdminAuth: boolean;
  adminData: AdminData | null;
  setIsAdminAuth: (auth: boolean) => void;
  checkAdminAuth: () => Promise<boolean>;
  isLoading: boolean;
  logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Функция для декодирования JWT без проверки подписи
function decodeJwt(token: string): { exp: number; sub: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch (err) {
    console.error('Ошибка при декодировании токена:', err);
    return null;
  }
}

// Проверяем, истек ли срок действия токена
function isTokenExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded) return true;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

// Функции для хранения и получения данных администратора из кэша
const STORAGE_KEYS = {
  ADMIN_TOKEN: 'admin_token',
  ADMIN_DATA: 'admin_data'
};

const getAdminCache = (): AdminData | null => {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem(STORAGE_KEYS.ADMIN_DATA);
  return cached ? JSON.parse(cached) : null;
};

const setAdminCache = (data: AdminData | null) => {
  if (typeof window === 'undefined') return;
  if (data) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_DATA, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_DATA);
  }
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isInitialLoad = useRef(true);
  const fetchingAdminData = useRef(false);
  const checkAuthInProgress = useRef(false);

  // Функция для загрузки данных администратора с сервера
  const fetchAdminData = useCallback(async (): Promise<AdminData | null> => {
    if (fetchingAdminData.current) return null;
    fetchingAdminData.current = true;
  
    try {
      let token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) return null;
  
      // Проверяем формат токена
      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }
  
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
  
      const response = await fetch('/admin/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
  
      clearTimeout(timeoutId);
  
      if (response.ok) {
        const data = await response.json();
        setAdminCache(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error('Ошибка загрузки данных администратора:', error);
      return null;
    } finally {
      fetchingAdminData.current = false;
    }
  }, []);

  // Функция для проверки авторизации администратора
  const checkAdminAuth = useCallback(async (): Promise<boolean> => {
    if (checkAuthInProgress.current) return isAdminAuth;
    
    checkAuthInProgress.current = true;
    
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) {
        setIsAdminAuth(false);
        setAdminData(null);
        setAdminCache(null);
        return false;
      }
      
      if (isTokenExpired(token)) {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        setAdminCache(null);
        setIsAdminAuth(false);
        setAdminData(null);
        return false;
      }
      
      setIsAdminAuth(true);
      
      if (!adminData) {
        const cachedData = getAdminCache();
        if (cachedData) {
          setAdminData(cachedData);
        }
      }
      
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        
        fetchAdminData().then(data => {
          if (data) {
            setAdminData(data);
          }
        }).catch(console.error);
      }
      
      return true;
    } catch (error) {
      console.error("Ошибка проверки авторизации администратора:", error);
      return isAdminAuth;
    } finally {
      setIsLoading(false);
      checkAuthInProgress.current = false;
    }
  }, [fetchAdminData, isAdminAuth, adminData]);

  // Функция для выхода
  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    setAdminCache(null);
    setIsAdminAuth(false);
    setAdminData(null);
    window.dispatchEvent(new Event("admin-auth-change"));
  }, []);

  // Инициализация из кэша - только один раз при монтировании компонента
  useEffect(() => {
    const initAuth = async () => {
      const cachedAdmin = getAdminCache();
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      
      if (cachedAdmin && token && !isTokenExpired(token)) {
        setAdminData(cachedAdmin);
        setIsAdminAuth(true);
      } else {
        setIsAdminAuth(false);
        if (!token) {
          setAdminData(null);
        }
      }
      
      await checkAdminAuth();
      setIsLoading(false);
    };
    
    initAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Настройка обработчиков событий - отдельный useEffect
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ADMIN_TOKEN) {
        checkAdminAuth();
      }
    };
    
    const handleAuthChange = () => checkAdminAuth();
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("admin-auth-change", handleAuthChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("admin-auth-change", handleAuthChange);
    };
  }, [checkAdminAuth]);

  const contextValue = {
    isAdminAuth, 
    adminData,
    setIsAdminAuth, 
    checkAdminAuth, 
    isLoading,
    logoutAdmin
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};