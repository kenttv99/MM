// src/contexts/PageLoadContext.tsx
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
  const previousPathRef = useRef<string | null>(null);

  // Reset loading state on route change
  useEffect(() => {
    if (previousPathRef.current && previousPathRef.current !== pathname) {
      // Only reset loading if we've actually changed pages
      setIsPageLoading(false);
      activeLoadingOperations.current.clear();
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    }
    previousPathRef.current = pathname;
  }, [pathname]);

  // Initialize and cleanup
  useEffect(() => {
    isUnmountedRef.current = false;
    
    // Only set loading to true on initial mount if explicitly specified
    if (initialState) {
      setIsPageLoading(initialState);
    }
    
    // Global safety timeout to prevent stuck loading states
    const globalSafetyTimeout = setTimeout(() => {
      if (isPageLoading) {
        console.warn("Global safety timeout triggered: resetting stuck loading state");
        setIsPageLoading(false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        activeLoadingOperations.current.clear();
      }
      safetyTimeoutRef.current = null;
    }, duration);
  }, [isPageLoading]);

  const setPageLoading = useCallback((loading: boolean) => {
    if (isUnmountedRef.current) return;
    
    setIsPageLoading(prevLoading => {
      // Only update if there's a change to avoid unnecessary renders
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
    
    // Only change loading state if we're not already loading
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
        
        // Only stop loading if no more active operations
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
        
        // Only stop loading if no more active operations
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