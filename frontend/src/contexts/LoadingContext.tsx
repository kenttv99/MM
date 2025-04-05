// frontend/src/contexts/LoadingContext.tsx
"use client";
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

interface LoadingContextType {
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
  setStaticLoading: (loading: boolean) => void;
  setDynamicLoading: (loading: boolean) => void;
  resetLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStaticLoading, setIsStaticLoading] = useState(false);
  const [isDynamicLoading, setIsDynamicLoading] = useState(false);
  const pathname = usePathname();
  const isMounted = useRef(false);
  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);
  const autoResetTimeout = useRef<NodeJS.Timeout | null>(null);
  const pathChangeCount = useRef<number>(0);
  const isStateChanging = useRef<boolean>(false);

  // Функции для управления состоянием загрузки
  const setStaticLoading = useCallback((value: boolean) => {
    if (!isMounted.current || isStateChanging.current) return;
    console.log("LoadingContext: setStaticLoading", value);
    setIsStaticLoading(value);
  }, []);

  const setDynamicLoading = useCallback((value: boolean) => {
    if (!isMounted.current || isStateChanging.current) return;
    console.log("LoadingContext: setDynamicLoading", value);
    setIsDynamicLoading(value);
  }, []);

  const resetLoading = useCallback(() => {
    if (!isMounted.current || isStateChanging.current) return;
    console.log("LoadingContext: resetLoading");
    setIsStaticLoading(false);
    setIsDynamicLoading(false);
  }, []);

  // Эффект для инициализации при монтировании
  useEffect(() => {
    console.log("LoadingContext: Component mounted");
    isMounted.current = true;
    
    // Сбрасываем все таймауты при размонтировании
    return () => {
      console.log("LoadingContext: Component unmounted");
      isMounted.current = false;
      
      // Сохраняем ссылки на таймауты в переменные внутри эффекта
      const loadingTimeoutValue = loadingTimeout.current;
      const autoResetTimeoutValue = autoResetTimeout.current;
      
      if (loadingTimeoutValue) {
        clearTimeout(loadingTimeoutValue);
      }
      if (autoResetTimeoutValue) {
        clearTimeout(autoResetTimeoutValue);
      }
    };
  }, []);

  // Эффект для отслеживания изменения пути
  useEffect(() => {
    if (!isMounted.current) return;
    
    console.log("LoadingContext: Pathname changed to", pathname);
    pathChangeCount.current += 1;
    
    // Устанавливаем флаг изменения состояния
    isStateChanging.current = true;
    
    // Сбрасываем состояние загрузки с задержкой
    const timeout = setTimeout(() => {
      if (isMounted.current) {
        // Для страницы мероприятий не сбрасываем состояние загрузки сразу,
        // так как EventsPage сам управляет состоянием загрузки
        if (pathname === "/events") {
          console.log("LoadingContext: Skipping reset for /events path");
          isStateChanging.current = false;
          return;
        }
        
        console.log("LoadingContext: Resetting loading states for pathname change");
        setStaticLoading(false);
        setDynamicLoading(false);
        isStateChanging.current = false;
      }
    }, 500); // Увеличиваем задержку до 500мс
    
    return () => {
      clearTimeout(timeout);
    };
  }, [pathname, setStaticLoading, setDynamicLoading]);

  // Эффект для автоматического сброса состояния загрузки
  useEffect(() => {
    if (!isMounted.current || isStateChanging.current) return;
    
    // Если состояние загрузки активно, устанавливаем таймер для автоматического сброса
    if (isStaticLoading || isDynamicLoading) {
      const timeout = setTimeout(() => {
        if (isMounted.current && !isStateChanging.current) {
          console.log("LoadingContext: Auto-resetting loading states");
          resetLoading();
        }
      }, 5000);
      
      autoResetTimeout.current = timeout;
      
      return () => {
        if (autoResetTimeout.current) {
          clearTimeout(autoResetTimeout.current);
        }
      };
    }
  }, [isStaticLoading, isDynamicLoading, resetLoading]);

  return (
    <LoadingContext.Provider value={{ isStaticLoading, isDynamicLoading, setStaticLoading, setDynamicLoading, resetLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error("useLoading must be used within a LoadingProvider");
  return context;
};