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

// Функция для декодирования JWT без проверки подписи
function decodeJwt(token: string): { exp: number; sub: string } | null {
  try {
    // JWT состоит из трех частей, разделенных точками
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Декодируем payload (вторую часть)
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
  
  // exp хранится в секундах от эпохи Unix
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

// Функция для хранения и получения данных пользователя из кэша
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
  const isInitialLoad = useRef(true);
  const fetchingUserData = useRef(false);
  const checkAuthInProgress = useRef(false);

  // Функция для загрузки данных пользователя с сервера
  const fetchUserData = useCallback(async (): Promise<UserData | null> => {
    if (fetchingUserData.current) return null;
    
    fetchingUserData.current = true;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;

      // Используем AbortController для установки таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут
      
      const response = await fetch("/auth/me", {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache"
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setUserCache(data);
        return data;
      }
      
      return null;
    } catch (error: unknown) {
      console.error("Ошибка загрузки данных пользователя:", error);
      return null;
    } finally {
      fetchingUserData.current = false;
    }
  }, []);

  // Функция для проверки авторизации без запроса к серверу
  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Предотвращаем одновременные вызовы checkAuth
    if (checkAuthInProgress.current) {
      return isAuth;
    }
    
    checkAuthInProgress.current = true;
    
    try {
      setIsLoading(true);
      
      // Проверяем наличие токена
      const token = localStorage.getItem("token");
      if (!token) {
        setIsAuth(false);
        setUserData(null);
        setUserCache(null);
        return false;
      }
      
      // Проверяем срок действия токена
      if (isTokenExpired(token)) {
        // Токен просрочен - очищаем всё
        localStorage.removeItem("token");
        setUserCache(null);
        setIsAuth(false);
        setUserData(null);
        return false;
      }
      
      // Токен действителен - устанавливаем авторизацию
      setIsAuth(true);
      
      // Если у нас нет данных пользователя, берем из кэша
      if (!userData) {
        const cachedData = getUserCache();
        if (cachedData) {
          setUserData(cachedData);
        }
      }
      
      // Обновляем данные с сервера только если это первая загрузка
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        
        // Асинхронно загружаем данные пользователя, но не ждем
        fetchUserData().then(data => {
          if (data) {
            setUserData(data);
          }
        }).catch(console.error);
      }
      
      return true;
    } catch (error: unknown) {
      console.error("Ошибка проверки авторизации:", error);
      return isAuth;
    } finally {
      setIsLoading(false);
      checkAuthInProgress.current = false;
    }
  }, [fetchUserData, isAuth, userData]);

  // Функция для выхода
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUserCache(null);
    setIsAuth(false);
    setUserData(null);
    window.dispatchEvent(new Event("auth-change"));
  }, []);

  // Инициализация из кэша - только один раз при монтировании компонента
  useEffect(() => {
    const initAuth = async () => {
      // Инициализация из кэша
      const cachedUser = getUserCache();
      const token = localStorage.getItem("token");
      
      if (cachedUser && token && !isTokenExpired(token)) {
        setUserData(cachedUser);
        setIsAuth(true);
      } else {
        setIsAuth(false);
        if (!token) {
          setUserData(null);
        }
      }
      
      // Выполняем полную проверку 
      await checkAuth();
      setIsLoading(false);
    };
    
    initAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив зависимостей - запускается только при монтировании

  // Настройка обработчиков событий - отдельный useEffect
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") {
        checkAuth();
      }
    };
    
    const handleAuthChange = () => checkAuth();
    
    window.addEventListener("storage", handleStorageChange);
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