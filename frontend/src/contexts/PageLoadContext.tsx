"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/utils/api";

interface PageLoadContextType {
  isPageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
  wrapAsync: <T>(promise: Promise<T>, options?: { timeout?: number }) => Promise<T>;
  apiFetch: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
}

const PageLoadContext = createContext<PageLoadContextType | undefined>(undefined);

interface PageLoadProviderProps {
  children: React.ReactNode;
  initialState?: boolean;
}

export function PageLoadProvider({ children, initialState = false }: PageLoadProviderProps) {
  const [isPageLoading, setIsPageLoading] = useState(initialState);
  const activeLoadingOperations = useRef<Set<string>>(new Set());
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const isUnmountedRef = useRef(false);

  // Сброс состояния при смене маршрута
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isPageLoading && activeLoadingOperations.current.size === 0 && !isUnmountedRef.current) {
        setIsPageLoading(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [pathname, isPageLoading]);

  // Инициализация и очистка
  useEffect(() => {
    isUnmountedRef.current = false;
    setIsPageLoading(initialState);
    return () => {
      isUnmountedRef.current = true;
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [initialState]);

  const setupSafetyTimeout = useCallback((duration: number = 8000) => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    safetyTimeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current && isPageLoading && activeLoadingOperations.current.size === 0) {
        console.warn("Safety timeout triggered: resetting page loading state");
        console.warn("Active operations at timeout:", [...activeLoadingOperations.current]);
        setIsPageLoading(false);
        activeLoadingOperations.current.clear();
      }
      safetyTimeoutRef.current = null;
    }, duration);
  }, [isPageLoading]);

  const setPageLoading = useCallback((loading: boolean) => {
    if (isUnmountedRef.current) return;
    setIsPageLoading(loading);
    if (loading) {
      setupSafetyTimeout();
    } else if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, [setupSafetyTimeout]);

  const wrapAsync = useCallback(<T,>(promise: Promise<T>, options: { timeout?: number } = { timeout: 10000 }): Promise<T> => {
    if (isUnmountedRef.current) return Promise.reject(new Error("Component unmounted"));

    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeLoadingOperations.current.add(operationId);
    if (!isPageLoading) setIsPageLoading(true);

    const safetyMs = options.timeout ? options.timeout + 3000 : 13000;
    setupSafetyTimeout(safetyMs);

    const timeoutMs = options.timeout ?? 10000;
    const timeoutPromise = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout exceeded")), timeoutMs)
    );

    return Promise.race([promise, timeoutPromise])
      .then((result) => {
        activeLoadingOperations.current.delete(operationId);
        if (activeLoadingOperations.current.size === 0 && !isUnmountedRef.current) {
          setIsPageLoading(false);
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
        }
        return result;
      })
      .catch((error) => {
        activeLoadingOperations.current.delete(operationId);
        if (activeLoadingOperations.current.size === 0 && !isUnmountedRef.current) {
          setIsPageLoading(false);
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
        }
        throw error;
      });
  }, [isPageLoading, setupSafetyTimeout]);

  // Глобальный safety timeout
  useEffect(() => {
    const globalSafetyTimeout = setTimeout(() => {
      if (isPageLoading && activeLoadingOperations.current.size === 0 && !isUnmountedRef.current) {
        console.warn("Global safety timeout triggered: resetting stuck loading state");
        setIsPageLoading(false);
      }
    }, 15000);
    return () => clearTimeout(globalSafetyTimeout);
  }, [isPageLoading]);

  const value: PageLoadContextType = {
    isPageLoading,
    setPageLoading,
    wrapAsync,
    apiFetch,
  };

  return <PageLoadContext.Provider value={value}>{children}</PageLoadContext.Provider>;
}

export function usePageLoad(): PageLoadContextType {
  const context = useContext(PageLoadContext);
  if (context === undefined) throw new Error("usePageLoad must be used within a PageLoadProvider");
  return context;
}