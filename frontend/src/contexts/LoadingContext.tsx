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

export const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [isStaticLoading, setStaticLoadingState] = useState(true);
  const [isDynamicLoading, setDynamicLoadingState] = useState(false);
  const pathname = usePathname();
  const hasReset = useRef<boolean>(false);
  const lastPathname = useRef<string>(pathname);
  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);
  const isMounted = useRef<boolean>(false);
  const autoResetTimeout = useRef<NodeJS.Timeout | null>(null);

  // Автоматический сброс состояния загрузки через 5 секунд
  useEffect(() => {
    if (isStaticLoading) {
      if (autoResetTimeout.current) {
        clearTimeout(autoResetTimeout.current);
      }
      
      autoResetTimeout.current = setTimeout(() => {
        if (isMounted.current) {
          console.log("Auto-resetting loading state after timeout");
          setStaticLoadingState(false);
          setDynamicLoadingState(false);
          hasReset.current = true;
        }
      }, 5000); // 5 секунд максимум для загрузки
    }
    
    return () => {
      if (autoResetTimeout.current) {
        clearTimeout(autoResetTimeout.current);
      }
    };
  }, [isStaticLoading]);

  const setStaticLoading = useCallback((loading: boolean) => {
    if (!isMounted.current) return;
    
    if (loadingTimeout.current) {
      clearTimeout(loadingTimeout.current);
    }
    
    loadingTimeout.current = setTimeout(() => {
      console.log("setStaticLoading:", loading, "pathname:", pathname);
      setStaticLoadingState(loading);
      if (loading) {
        hasReset.current = false;
      }
    }, 50);
  }, [pathname]);

  const setDynamicLoading = useCallback((loading: boolean) => {
    if (!isMounted.current) return;
    
    if (loadingTimeout.current) {
      clearTimeout(loadingTimeout.current);
    }
    
    loadingTimeout.current = setTimeout(() => {
      console.log("setDynamicLoading:", loading, "pathname:", pathname);
      setDynamicLoadingState(loading);
    }, 50);
  }, [pathname]);

  const resetLoading = useCallback(() => {
    if (!isMounted.current) return;
    
    if (!hasReset.current) {
      console.log("Resetting loading state for pathname:", pathname);
      setStaticLoadingState(true);
      setDynamicLoadingState(false);
      hasReset.current = true;
    } else {
      console.log("Skipping resetLoading, already set manually for pathname:", pathname);
    }
  }, [pathname]);

  useEffect(() => {
    console.log("LoadingContext useEffect triggered for pathname:", pathname);
    
    // Устанавливаем флаг монтирования
    isMounted.current = true;
    
    // Пропускаем первый рендер и ждем инициализации AuthContext
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return () => {
        isMounted.current = false;
        if (loadingTimeout.current) {
          clearTimeout(loadingTimeout.current);
        }
        if (autoResetTimeout.current) {
          clearTimeout(autoResetTimeout.current);
        }
      };
    }

    // Сбрасываем состояния только при смене пути и после инициализации AuthContext
    if (lastPathname.current !== pathname && !isInitialMount.current) {
      resetLoading();
      lastPathname.current = pathname;
    }

    return () => {
      isMounted.current = false;
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
      }
      if (autoResetTimeout.current) {
        clearTimeout(autoResetTimeout.current);
      }
    };
  }, [pathname, resetLoading]);

  return (
    <LoadingContext.Provider
      value={{ isStaticLoading, isDynamicLoading, setStaticLoading, setDynamicLoading, resetLoading }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error("useLoading must be used within a LoadingProvider");
  return context;
};