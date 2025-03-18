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
  const lastUserDataFetchRef = useRef<number>(0);
  const useVerifyTokenEndpoint = useRef<boolean>(true); // Будем пробовать использовать эндпоинт, но при ошибках отключим

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

  // Загрузка полных данных пользователя (используется реже)
  const loadUserData = useCallback(async (): Promise<UserData | null> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;

      // Ограничиваем частые запросы данных пользователя
      const now = Date.now();
      if (now - lastUserDataFetchRef.current < 30000) { // Не чаще раза в 30 секунд
        return userData || getUserCache();
      }
      
      lastUserDataFetchRef.current = now;
      
      const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else if (response.status === 429) {
        // При превышении лимита используем кэшированные данные
        console.warn("User data fetch rate limited, using cached data");
        return userData || getUserCache();
      } else if (response.status === 401) {
        // Токен недействителен
        return null;
      }
      
      return null;
    } catch (error) {
      console.error("Ошибка загрузки данных пользователя:", error);
      return null;
    }
  }, [userData]);

  // Проверка только валидности токена (используется чаще)
  const verifyToken = useCallback(async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;

      // Если предыдущие попытки показали, что эндпоинт недоступен, 
      // используем стандартный /me
      if (!useVerifyTokenEndpoint.current) {
        console.log("Using /me endpoint for token verification (verify_token unavailable)");
        const userData = await loadUserData();
        return userData !== null;
      }

      try {
        const response = await fetch("/auth/verify_token", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          return true;
        } else if (response.status >= 500) {
          // Если эндпоинт вернул серверную ошибку, отключаем его использование
          console.warn("verify_token endpoint returned server error, falling back to /me");
          useVerifyTokenEndpoint.current = false;
          
          // Пробуем через /me
          const userData = await loadUserData();
          return userData !== null;
        } else if (response.status === 401) {
          // Явно невалидный токен
          return false;
        }
        
        // Любой другой статус считаем ошибкой
        return false;
      } catch (error) {
        // При ошибке сети переключаемся на /me
        console.error("Error accessing verify_token endpoint:", error);
        useVerifyTokenEndpoint.current = false;
        
        const userData = await loadUserData();
        return userData !== null;
      }
    } catch (error) {
      console.error("Error in verifyToken:", error);
      return false;
    }
  }, [loadUserData]);

  // Проверка аутентификации с двухуровневым подходом
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckRef.current;
    
    // Если проверка уже выполняется, возвращаем существующий промис
    if (checkInProgressRef.current) {
      return checkInProgressRef.current;
    }
    
    // Ограничиваем частоту проверок
    if (timeSinceLastCheck < 5000 && lastCheckRef.current !== 0) {
      return isAuth; // Возвращаем текущее состояние без проверки
    }
    
    // Устанавливаем загрузку только при первой загрузке
    if (lastCheckRef.current === 0) {
      setIsLoading(true);
    }
    
    lastCheckRef.current = now;
    
    const checkPromise = new Promise<boolean>(async (resolve) => {
      try {
        // Проверяем наличие токена
        const token = localStorage.getItem("token");
        if (!token) {
          setIsAuth(false);
          setUserData(null);
          setUserCache(null);
          setIsLoading(false);
          resolve(false);
          return;
        }
        
        // Шаг 1: Проверка валидности токена (через verify_token или me)
        const isValidToken = await verifyToken();
        
        if (!isValidToken) {
          // Токен невалиден - очищаем всё
          localStorage.removeItem("token");
          setUserCache(null);
          setIsAuth(false);
          setUserData(null);
          resolve(false);
        } else {
          // Токен валиден - устанавливаем аутентификацию
          setIsAuth(true);
          
          // Шаг 2: Если у нас нет данных пользователя, загружаем их
          if (!userData) {
            const cachedUserData = getUserCache(); 
            
            if (cachedUserData) {
              setUserData(cachedUserData);
            }
            
            // Асинхронно загружаем актуальные данные
            loadUserData().then(data => {
              if (data) {
                setUserData(data);
                setUserCache(data);
              }
            }).catch(console.error);
          }
          
          resolve(true);
        }
      } catch (error) {
        console.error("Ошибка проверки аутентификации:", error);
        // При серьезной ошибке возвращаем текущее состояние
        resolve(isAuth);
      } finally {
        setIsLoading(false);
        checkInProgressRef.current = null;
      }
    });
    
    checkInProgressRef.current = checkPromise;
    return checkPromise;
  }, [isAuth, userData, verifyToken, loadUserData]);

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