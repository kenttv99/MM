// frontend/src/contexts/LoadingContext.tsx
"use client";
import { createContext, useContext, useState, useEffect, useRef } from "react";
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
  const [isStaticLoading, setStaticLoadingState] = useState(true); // Изначально true
  const [isDynamicLoading, setDynamicLoadingState] = useState(false);
  const pathname = usePathname();
  const hasReset = useRef(false);

  const setStaticLoading = (loading: boolean) => {
    console.log("setStaticLoading:", loading, "pathname:", pathname);
    setStaticLoadingState(loading);
    hasReset.current = true; // Помечаем, что состояние установлено вручную
  };

  const setDynamicLoading = (loading: boolean) => {
    console.log("setDynamicLoading:", loading, "pathname:", pathname);
    setDynamicLoadingState(loading);
  };

  const resetLoading = () => {
    if (!hasReset.current) {
      console.log("Resetting loading state for pathname:", pathname);
      setStaticLoadingState(true);
      setDynamicLoadingState(false);
      hasReset.current = true;
    } else {
      console.log("Skipping resetLoading, already set manually for pathname:", pathname);
    }
  };

  useEffect(() => {
    console.log("LoadingContext useEffect triggered for pathname:", pathname);
    resetLoading();
    hasReset.current = false; // Сбрасываем флаг при смене пути
  }, [pathname]);

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