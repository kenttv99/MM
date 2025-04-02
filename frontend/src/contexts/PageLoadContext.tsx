// frontend/src/contexts/PageLoadContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/utils/api";

interface PageLoadProviderProps {
  children: React.ReactNode;
  initialState?: boolean;
}

interface PageLoadContextType {
  isPageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
  wrapAsync: <T>(promise: Promise<T>, options?: { timeout?: number }) => Promise<T>;
  apiFetch: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
  hasServerError: boolean;
  hasNetworkError: boolean;
  setHasServerError: (error: boolean) => void;
  setHasNetworkError: (error: boolean) => void;
}

const PageLoadContext = createContext<PageLoadContextType | undefined>(undefined);

export function PageLoadProvider({ children, initialState = false }: PageLoadProviderProps) {
  const [isPageLoading, setIsPageLoading] = useState(initialState);
  const [hasServerError, setHasServerError] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const activeLoadingOperations = useRef<Set<string>>(new Set());
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const isUnmountedRef = useRef(false);
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathRef.current && previousPathRef.current !== pathname) {
      setIsPageLoading(false);
      setHasServerError(false);
      setHasNetworkError(false);
      activeLoadingOperations.current.clear();
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    }
    previousPathRef.current = pathname;
  }, [pathname, isPageLoading]);

  useEffect(() => {
    isUnmountedRef.current = false;
    
    if (initialState) {
      setIsPageLoading(initialState);
    }
    
    const globalSafetyTimeout = setTimeout(() => {
      if (isPageLoading) {
        console.warn("Global safety timeout triggered: resetting stuck loading state");
        setIsPageLoading(false);
        setHasServerError(false);
        setHasNetworkError(false);
        activeLoadingOperations.current.clear();
      }
    }, 10000);
    
    return () => {
      isUnmountedRef.current = true;
      clearTimeout(globalSafetyTimeout);
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [initialState]);

  const setupSafetyTimeout = useCallback((duration: number = 8000) => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    safetyTimeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current && isPageLoading) {
        console.warn("Safety timeout triggered: resetting page loading state");
        if (activeLoadingOperations.current.size > 0) {
          console.warn("Active operations at timeout:", [...activeLoadingOperations.current]);
        }
        setIsPageLoading(false);
        setHasServerError(false);
        setHasNetworkError(false);
        activeLoadingOperations.current.clear();
      }
      safetyTimeoutRef.current = null;
    }, duration);
  }, [isPageLoading]);

  const setPageLoading = useCallback((loading: boolean) => {
    if (isUnmountedRef.current) return;
    
    setIsPageLoading((prevLoading: boolean) => {
      if (prevLoading !== loading) {
        if (loading) {
          setupSafetyTimeout();
        } else if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        return loading;
      }
      return prevLoading;
    });
  }, [setupSafetyTimeout]);

  const wrapAsync = useCallback(<T,>(promise: Promise<T>, options: { timeout?: number } = { timeout: 10000 }): Promise<T> => {
    if (isUnmountedRef.current) return Promise.reject(new Error("Component unmounted"));

    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeLoadingOperations.current.add(operationId);
    
    if (!isPageLoading) {
      setIsPageLoading(true);
    }

    const safetyMs = options.timeout ? options.timeout + 3000 : 13000;
    setupSafetyTimeout(safetyMs);

    const timeoutMs = options.timeout ?? 10000;
    const timeoutPromise = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout exceeded (${timeoutMs}ms)`)), timeoutMs)
    );

    return Promise.race([promise, timeoutPromise])
      .then((result) => {
        activeLoadingOperations.current.delete(operationId);
        
        if (activeLoadingOperations.current.size === 0 && !isUnmountedRef.current) {
          setIsPageLoading(false);
          setHasServerError(false);
          setHasNetworkError(false);
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
        if (error instanceof Error && 'status' in error && error.status === 500) {
          setHasServerError(true);
        } else if (error instanceof Error && 'isNetworkError' in error && error.isNetworkError) {
          setHasNetworkError(true);
        }
        throw error;
      });
  }, [isPageLoading, setupSafetyTimeout]);

  const value: PageLoadContextType = {
    isPageLoading,
    setPageLoading,
    wrapAsync,
    apiFetch,
    hasServerError,
    hasNetworkError,
    setHasServerError,
    setHasNetworkError,
  };

  return <PageLoadContext.Provider value={value}>{children}</PageLoadContext.Provider>;
}

export function usePageLoad(): PageLoadContextType {
  const context = useContext(PageLoadContext);
  if (context === undefined) throw new Error("usePageLoad must be used within a PageLoadProvider");
  return context;
}