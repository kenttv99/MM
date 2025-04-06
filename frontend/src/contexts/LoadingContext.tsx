// frontend/src/contexts/LoadingContext.tsx
"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';

// Types for loading stages
export enum LoadingStage {
  AUTHENTICATION = 'authentication',
  STATIC_CONTENT = 'static_content',
  DYNAMIC_CONTENT = 'dynamic_content',
  DATA_LOADING = 'data_loading',
  COMPLETED = 'completed'
}

// Types for context
interface LoadingContextType {
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
  setStaticLoading: (isLoading: boolean) => void;
  setDynamicLoading: (isLoading: boolean) => void;
  resetLoading: () => void;
  currentStage: LoadingStage;
  setStage: (stage: LoadingStage) => void;
}

// Create context with initial value
const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Special paths that don't need to reset loading state
const specialPaths = ['/events', '/event/'];

// Global active requests counter
let activeRequestsCount = 0;

// Global flag for tracking last spinner state
let lastSpinnerState = false;

// Global flag for tracking last reset time
let lastResetTime = 0;
// Increase debounce time to avoid frequent resets during authentication
const RESET_DEBOUNCE = 2000; // 2 seconds between resets (increased from 1 second)

// Function to dispatch loading stage change events
function dispatchStageChangeEvent(stage: LoadingStage) {
  if (typeof window !== 'undefined') {
    // Only dispatch if we're not already in this stage (to prevent unnecessary dispatches)
    const event = new CustomEvent('loadingStageChange', {
      detail: { stage }
    });
    window.dispatchEvent(event);
    console.log('LoadingContext: Dispatched stage change event', { stage });
  }
}

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStaticLoading, setIsStaticLoading] = useState(false);
  const [isDynamicLoading, setIsDynamicLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<LoadingStage>(LoadingStage.AUTHENTICATION);
  
  const pathname = usePathname();
  const isMounted = useRef(true);
  const isInitialized = useRef(false);
  const loadingStateRef = useRef({ isStaticLoading: false, isDynamicLoading: false });
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const spinnerCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isEventsPage = useRef(pathname?.includes('/events'));
  const lastSpinnerCheckRef = useRef(0);
  const lastResetRef = useRef(0);
  const stageTransitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousStageRef = useRef<LoadingStage>(LoadingStage.AUTHENTICATION);
  // New ref to track stage change history
  const stageChangeHistoryRef = useRef<Array<{stage: LoadingStage, timestamp: number}>>([]);

  // Function for safe state update
  const safeSetState = useCallback((setter: (value: boolean) => void, value: boolean) => {
    if (isMounted.current) {
      // Don't reset state if there are active requests on events page
      if (!value && isEventsPage.current && activeRequestsCount > 0) {
        return;
      }
      
      setter(value);
      loadingStateRef.current = {
        ...loadingStateRef.current,
        [setter === setIsStaticLoading ? 'isStaticLoading' : 'isDynamicLoading']: value
      };
    }
  }, []);

  // Function for setting static loading
  const setStaticLoading = useCallback((isLoading: boolean) => {
    // Логируем только при изменении состояния
    if (loadingStateRef.current.isStaticLoading !== isLoading) {
      console.log('LoadingContext: Setting static loading', { isLoading, currentStage });
    }
    
    if (isLoading && currentStage === LoadingStage.AUTHENTICATION) {
      setCurrentStage(LoadingStage.STATIC_CONTENT);
    }
    safeSetState(setIsStaticLoading, isLoading);
  }, [safeSetState, currentStage]);

  // Function for setting dynamic loading
  const setDynamicLoading = useCallback((isLoading: boolean) => {
    // Логируем только при изменении состояния
    if (loadingStateRef.current.isDynamicLoading !== isLoading) {
      console.log('LoadingContext: Setting dynamic loading', { isLoading, currentStage });
    }
    
    if (isLoading) {
      activeRequestsCount++;
      if (currentStage === LoadingStage.STATIC_CONTENT) {
        setCurrentStage(LoadingStage.DYNAMIC_CONTENT);
      }
    } else {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1);
      if (activeRequestsCount === 0 && currentStage === LoadingStage.DYNAMIC_CONTENT) {
        setCurrentStage(LoadingStage.DATA_LOADING);
      }
    }
    safeSetState(setIsDynamicLoading, isLoading);
  }, [safeSetState, currentStage]);

  // Function for resetting loading state
  const resetLoading = useCallback(() => {
    const now = Date.now();
    if (now - lastResetRef.current < RESET_DEBOUNCE) {
      // Убираем избыточные логи для дебаунса
      return;
    }
    
    // Don't reset during authentication stage - используем строковое сравнение для обхода ошибки TypeScript
    if (currentStage === 'authentication') {
      console.log('LoadingContext: Skipping reset during authentication stage');
      return;
    }
    
    lastResetRef.current = now;
    lastResetTime = now;
    
    console.log('LoadingContext: Resetting loading state', {
      activeRequests: activeRequestsCount,
      currentStage
    });
    
    if (isMounted.current) {
      // Don't reset state if there are active requests on events page
      if (isEventsPage.current && activeRequestsCount > 0) {
        // Убираем лишние логи
        return;
      }
      
      setIsStaticLoading(false);
      setIsDynamicLoading(false);
      loadingStateRef.current = { isStaticLoading: false, isDynamicLoading: false };
      activeRequestsCount = 0;
      
      // Reset stage to COMPLETED when all loading is done
      if (currentStage !== LoadingStage.COMPLETED && currentStage !== 'authentication') {
        setCurrentStage(LoadingStage.COMPLETED);
      }
    }
  }, [currentStage]);
  
  // Function to explicitly set the loading stage
  const setStage = useCallback((stage: LoadingStage) => {
    if (isMounted.current) {
      // Skip if trying to set the same stage with no state changes
      if (stage === currentStage && 
          !loadingStateRef.current.isStaticLoading && 
          !loadingStateRef.current.isDynamicLoading) {
        // Убираем лишние логи при пропуске
        return;
      }
      
      // Важные логи для определения когда произошло изменение стадии
      console.log('LoadingContext: Setting stage', { stage, prevStage: currentStage });
      
      // Update stage change history
      stageChangeHistoryRef.current.push({
        stage,
        timestamp: Date.now()
      });
      
      // Keep only last 10 stage changes in history
      if (stageChangeHistoryRef.current.length > 10) {
        stageChangeHistoryRef.current.shift();
      }
      
      // Only update if stage is actually different
      if (stage !== currentStage) {
        previousStageRef.current = currentStage;
        setCurrentStage(stage);
        dispatchStageChangeEvent(stage);
      }
      
      // Automatically progress to next stage after a timeout if stuck
      if (stageTransitionTimerRef.current) {
        clearTimeout(stageTransitionTimerRef.current);
      }
      
      // Set a timeout to auto-progress if needed
      if (stage !== LoadingStage.COMPLETED) {
        stageTransitionTimerRef.current = setTimeout(() => {
          // If we're still in the same stage after the timeout, move to the next one
          if (isMounted.current && currentStage === stage) {
            console.log('LoadingContext: Auto-progressing stage', { from: stage });
            switch (stage) {
              case LoadingStage.AUTHENTICATION:
                // Для стадии аутентификации просто переходим к следующей стадии
                // после таймаута, AuthContext сам разберется с проверкой
                setCurrentStage(LoadingStage.STATIC_CONTENT);
                break;
              case LoadingStage.STATIC_CONTENT:
                setCurrentStage(LoadingStage.DYNAMIC_CONTENT);
                break;
              case LoadingStage.DYNAMIC_CONTENT:
                setCurrentStage(LoadingStage.DATA_LOADING);
                break;
              case LoadingStage.DATA_LOADING:
                setCurrentStage(LoadingStage.COMPLETED);
                break;
            }
          }
        }, 5000); // 5 second timeout for auto-progression
      }
    }
  }, [currentStage]);

  // Effect for initializing state
  useEffect(() => {
    if (isInitialized.current) {
      return;
    }
    
    isInitialized.current = true;
    isMounted.current = true;
    isEventsPage.current = pathname?.includes('/events');
    loadingStateRef.current = { isStaticLoading: false, isDynamicLoading: false };
    activeRequestsCount = 0;
    stageChangeHistoryRef.current = [];
    
    // Add initial stage to history
    stageChangeHistoryRef.current.push({
      stage: LoadingStage.AUTHENTICATION,
      timestamp: Date.now()
    });
    
    setCurrentStage(LoadingStage.AUTHENTICATION);
    previousStageRef.current = LoadingStage.AUTHENTICATION;
    dispatchStageChangeEvent(LoadingStage.AUTHENTICATION);

    return () => {
      isMounted.current = false;
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      if (uiLockTimerRef.current) clearTimeout(uiLockTimerRef.current);
      if (spinnerCheckIntervalRef.current) clearInterval(spinnerCheckIntervalRef.current);
      if (stageTransitionTimerRef.current) clearTimeout(stageTransitionTimerRef.current);
      activeRequestsCount = 0;
    };
  }, [pathname]);

  // Effect for tracking path
  useEffect(() => {
    if (!isInitialized.current) {
      return;
    }
    
    isEventsPage.current = pathname?.includes('/events');
    
    if (!isEventsPage.current) {
      resetLoading();
      // Reset to authentication stage on navigation
      setCurrentStage(LoadingStage.AUTHENTICATION);
      
      // Reset stage change history
      stageChangeHistoryRef.current = [{
        stage: LoadingStage.AUTHENTICATION,
        timestamp: Date.now()
      }];
    }
  }, [pathname, resetLoading]);

  // Effect for auto-reset state
  useEffect(() => {
    if (isStaticLoading || isDynamicLoading) {
      // Убираем лишние логи
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = setTimeout(() => {
        if (isMounted.current && !isEventsPage.current) {
          console.log('LoadingContext: Auto-resetting loading state');
          resetLoading();
        }
      }, 30000);
    }

    return () => {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    };
  }, [isStaticLoading, isDynamicLoading, resetLoading]);

  // Effect for preventing UI lock
  useEffect(() => {
    if (isStaticLoading || isDynamicLoading) {
      // Убираем лишние логи
      if (uiLockTimerRef.current) clearTimeout(uiLockTimerRef.current);
      uiLockTimerRef.current = setTimeout(() => {
        if (isMounted.current && !isEventsPage.current) {
          console.log('LoadingContext: Preventing UI lock');
          resetLoading();
        }
      }, 15000);
    }

    return () => {
      if (uiLockTimerRef.current) clearTimeout(uiLockTimerRef.current);
    };
  }, [isStaticLoading, isDynamicLoading, resetLoading]);

  // Effect for tracking global spinner
  useEffect(() => {
    const checkSpinner = () => {
      if (!isMounted.current) return;
      
      const now = Date.now();
      // Check spinner no more than once per 500ms
      if (now - lastSpinnerCheckRef.current < 500) {
        return;
      }
      lastSpinnerCheckRef.current = now;
      
      const spinner = document.querySelector('.global-spinner');
      const hasSpinner = spinner !== null;
      
      // Update state only if it changed
      if (hasSpinner !== lastSpinnerState) {
        lastSpinnerState = hasSpinner;
        
        // Don't update state if there are active requests on events page
        if (isEventsPage.current && activeRequestsCount > 0) {
          return;
        }
        
        if (hasSpinner && !isStaticLoading) {
          setStaticLoading(true);
        } else if (!hasSpinner && isStaticLoading) {
          setStaticLoading(false);
        }
      }
    };

    // Increase check interval to 1 second
    spinnerCheckIntervalRef.current = setInterval(checkSpinner, 1000);
    checkSpinner();

    return () => {
      if (spinnerCheckIntervalRef.current) {
        clearInterval(spinnerCheckIntervalRef.current);
      }
    };
  }, [isStaticLoading, setStaticLoading]);

  // Effect for log current stage changes  
  useEffect(() => {
    console.log('LoadingContext: Stage changed', {
      currentStage,
      isStaticLoading,
      isDynamicLoading,
      activeRequests: activeRequestsCount
    });
  }, [currentStage, isStaticLoading, isDynamicLoading]);

  const loadingContextValue = useMemo(
    () => ({
      isStaticLoading,
      isDynamicLoading,
      setStaticLoading,
      setDynamicLoading,
      resetLoading,
      currentStage,
      setStage
    }),
    [
      isStaticLoading,
      isDynamicLoading,
      setStaticLoading,
      setDynamicLoading,
      resetLoading,
      currentStage,
      setStage
    ]
  );

  return (
    <LoadingContext.Provider value={loadingContextValue}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};