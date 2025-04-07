// frontend/src/contexts/LoadingContext.tsx
"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';

// Types for loading stages
export enum LoadingStage {
  AUTHENTICATION = 'authentication',
  STATIC_CONTENT = 'static_content',
  DYNAMIC_CONTENT = 'dynamic_content',
  DATA_LOADING = 'data_loading',
  COMPLETED = 'completed'
}

// Type guard for checking if a stage is AUTHENTICATION
function isAuthenticationStage(stage: LoadingStage): stage is LoadingStage.AUTHENTICATION {
  return stage === LoadingStage.AUTHENTICATION;
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

// Добавим базовые настройки для логов
const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

// Устанавливаем уровень логирования (можно менять при разработке/продакшене)
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.WARN 
  : LOG_LEVEL.INFO;

// Вспомогательные функции для логирования с разными уровнями
const logDebug = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
    console.log(`LoadingContext: ${message}`, data);
  }
};

const logInfo = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
    console.log(`LoadingContext: ${message}`, data);
  }
};

const logWarn = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
    console.log(`LoadingContext: ⚠️ ${message}`, data);
  }
};

const logError = (message: string, data?: any) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
    console.error(`LoadingContext: ⛔ ${message}`, data);
  }
};

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

// Добавим хранение последнего состояния динамической загрузки для предотвращения дублирования
let lastDynamicLoadingState = false;

// Полностью переработанная функция диспетчеризации событий стадии
function dispatchStageChangeEvent(stage: LoadingStage, stageChangeHistoryRef: React.MutableRefObject<{stage: LoadingStage, timestamp: number}[]>) {
  if (typeof window === 'undefined') return;
  
  // Диспетчеризируем событие для слушателей без лишних проверок и перенаправлений
  const event = new CustomEvent('loadingStageChange', {
    detail: { stage }
  });
  
  window.dispatchEvent(event);
  
  // Добавляем запись в историю
  const now = Date.now();
  stageChangeHistoryRef.current.push({
    stage,
    timestamp: now
  });
  
  // Ограничиваем историю последними 10 записями
  if (stageChangeHistoryRef.current.length > 10) {
    stageChangeHistoryRef.current.shift();
  }
  
  logDebug('Dispatched stage change event', { stage });
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
  // New ref to track if we've been past authentication
  const hasBeenPastAuthenticationRef = useRef(false);

  // Helper function to get the level of a loading stage
  const getStageLevel = useCallback((stage: LoadingStage): number => {
    switch (stage) {
      case LoadingStage.AUTHENTICATION: return 0;
      case LoadingStage.STATIC_CONTENT: return 1;
      case LoadingStage.DYNAMIC_CONTENT: return 2;
      case LoadingStage.DATA_LOADING: return 3;
      case LoadingStage.COMPLETED: return 4;
      default: return -1;
    }
  }, []);

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
    // Пропускаем обновление, если состояние не изменилось
    if (loadingStateRef.current.isDynamicLoading === isLoading && lastDynamicLoadingState === isLoading) {
      return;
    }
    
    // Обновляем глобальное состояние
    lastDynamicLoadingState = isLoading;
    
    // Логируем только при изменении состояния
    if (loadingStateRef.current.isDynamicLoading !== isLoading) {
      logInfo('Setting dynamic loading', { isLoading, currentStage });
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
    
    // Don't reset during authentication stage
    if (currentStage === LoadingStage.AUTHENTICATION) {
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
      const stage = currentStage as LoadingStage;
      if (stage !== LoadingStage.COMPLETED && stage !== LoadingStage.AUTHENTICATION) {
        setCurrentStage(LoadingStage.COMPLETED);
      }
    }
  }, [currentStage]);
  
  // Internal function to set stage that handles stage change history and other logic
  const setStageInternal = useCallback((stage: LoadingStage) => {
    if (!isMounted.current) {
      return;
    }
    
    // Обнаружение циклов установки одной и той же стадии
    const now = Date.now();
    const recentSameStageChanges = stageChangeHistoryRef.current
      .filter(entry => entry.stage === stage && now - entry.timestamp < 2000)
      .length;
    
    // Если часто повторяем одну и ту же стадию, это может быть цикл
    if (recentSameStageChanges >= 3) {
      logWarn('Detected potential stage change loop', {
        stage,
        recentChanges: recentSameStageChanges,
        history: [...stageChangeHistoryRef.current]
      });
      return; // Прерываем цикл, не устанавливая стадию
    }
    
    // Особая обработка возвратов к стадии AUTHENTICATION
    if (stage === LoadingStage.AUTHENTICATION) {
      // Проверяем, были ли мы на более высокой стадии  
      const hasBeenPastAuth = stageChangeHistoryRef.current.some(
        entry => entry.stage !== LoadingStage.AUTHENTICATION
      );
      
      if (hasBeenPastAuth) {
        logWarn('Preventing regression to AUTHENTICATION after being at higher stages', {
          currentStage,
          history: [...stageChangeHistoryRef.current]
        });
        return; // Просто блокируем без перенаправления
      }
    }
    
    // Пропускаем установку, если стадия не изменилась
    if (stage === currentStage) {
      return;
    }
    
    logInfo('Setting stage', { stage, prevStage: currentStage });
    
    // Обновляем состояние
    previousStageRef.current = currentStage;
    setCurrentStage(stage);
    
    // Отправляем событие изменения стадии
    dispatchStageChangeEvent(stage, stageChangeHistoryRef);
    
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
    dispatchStageChangeEvent(LoadingStage.AUTHENTICATION, stageChangeHistoryRef);

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
      
      // Проверяем через глобальную историю стадий
      const hasBeenPastAuth = stageChangeHistoryRef.current.some(entry => entry.stage !== 'authentication');
      
      // Никогда не сбрасываем до AUTHENTICATION, если мы уже были на других стадиях
      if (hasBeenPastAuth) {
        console.log('LoadingContext: Skipping reset to AUTHENTICATION stage - already been past auth', { 
          currentStage, 
          hasBeenPastAuth,
          stageHistory: stageChangeHistoryRef.current 
        });
        return;
      }
      
      // Проверяем, можно ли безопасно сбросить до AUTHENTICATION
      const canResetToAuth = 
        // Если мы и так в стадии аутентификации, то можно просто обновить
        currentStage === 'authentication' || 
        // Если нет активных загрузок, то можно сбросить
        (!loadingStateRef.current.isStaticLoading && 
         !loadingStateRef.current.isDynamicLoading && 
         activeRequestsCount === 0);
      
      if (canResetToAuth) {
        console.log('LoadingContext: Resetting to AUTHENTICATION stage on navigation', { 
          currentStage, 
          pathname,
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount
        });
        
        // Reset to authentication stage on navigation
        setStageInternal(LoadingStage.AUTHENTICATION);
        
        // Reset stage change history
        stageChangeHistoryRef.current = [{
          stage: LoadingStage.AUTHENTICATION,
          timestamp: Date.now()
        }];
      } else {
        console.log('LoadingContext: Skipping reset to AUTHENTICATION stage', { 
          currentStage, 
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount,
          pathname 
        });
      }
    }
  }, [pathname, currentStage, resetLoading, setStageInternal]);

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

  // Effect for handling stage changes
  useEffect(() => {
    // Если мы были на стадии выше AUTHENTICATION, запоминаем это
    if (currentStage !== LoadingStage.AUTHENTICATION) {
      hasBeenPastAuthenticationRef.current = true;
    }
    
    // Определяем, находимся ли мы в состоянии регрессии (переход с более высокой стадии к более низкой)
    const prevStage = stageChangeHistoryRef.current.length > 0 ? 
      stageChangeHistoryRef.current[stageChangeHistoryRef.current.length - 1].stage : 
      null;
    const isRegression = prevStage && getStageLevel(currentStage) < getStageLevel(prevStage as LoadingStage);
    
    // Добавляем дополнительную проверку для исключения ложных срабатываний
    const isPossibleFalseRegression = stageChangeHistoryRef.current.length <= 2 || 
                                     Date.now() - lastResetRef.current < 500; // Исключаем определение регрессии сразу после сброса
    
    // Если это регрессия к AUTHENTICATION, логируем предупреждение
    if (isRegression && currentStage === LoadingStage.AUTHENTICATION && 
        stageChangeHistoryRef.current.length > 2 && !isPossibleFalseRegression) {
      // Логируем предупреждение, но уменьшаем до logWarn
      logWarn('Detected regression to AUTHENTICATION, forcing STATIC_CONTENT', {
        stageHistory: [...stageChangeHistoryRef.current]
      });
      
      // Принудительно переводим на стадию STATIC_CONTENT с небольшой задержкой
      // чтобы избежать циклических обновлений состояния
      setTimeout(() => {
        if (isMounted.current) {
          setCurrentStage(LoadingStage.STATIC_CONTENT);
        }
      }, 0);
      return;
    }
    
    // НОВОЕ ИСПРАВЛЕНИЕ: специальная обработка для страницы событий
    if (currentStage === LoadingStage.AUTHENTICATION && isEventsPage.current) {
      // Если мы на странице событий и застряли на стадии AUTHENTICATION, 
      // устанавливаем таймер для принудительного перехода
      const eventsPageTimer = setTimeout(() => {
        if (isMounted.current && currentStage === LoadingStage.AUTHENTICATION) {
          logWarn('Events page stuck in AUTHENTICATION, force progressing to STATIC_CONTENT');
          setCurrentStage(LoadingStage.STATIC_CONTENT);
        }
      }, 800); // Ускоряем таймаут для страницы событий
      
      return () => clearTimeout(eventsPageTimer);
    }
    
    // Логируем изменение стадии только для статистики (уменьшаем до logDebug)
    logDebug('Stage changed', {
      currentStage,
      isStaticLoading,
      isDynamicLoading,
      activeRequests: activeRequestsCount
    });
    
  }, [currentStage, isStaticLoading, isDynamicLoading, getStageLevel]);

  // Effect for handling navigation
  useEffect(() => {
    const handleNavigation = () => {
      // Проверяем через глобальную историю стадий
      const hasBeenPastAuth = stageChangeHistoryRef.current.some(entry => entry.stage !== 'authentication');
      
      // Не сбрасываем до AUTHENTICATION, если мы уже были на другой стадии
      if (hasBeenPastAuth) {
        console.log('LoadingContext: Skipping navigation reset - already been past AUTHENTICATION stage', {
          currentStage,
          isStaticLoading,
          isDynamicLoading,
          activeRequests: activeRequestsCount,
          stageHistory: stageChangeHistoryRef.current
        });
        return;
      }
      
      // Don't reset to AUTHENTICATION if we're already past it
      // Используем строковое сравнение, чтобы избежать проблем с типизацией
      if (currentStage !== 'authentication') {
        console.log('LoadingContext: Skipping navigation reset - already past AUTHENTICATION stage', {
          currentStage,
          isStaticLoading,
          isDynamicLoading,
          activeRequests: activeRequestsCount
        });
        return;
      }

      // Only reset if we're in AUTHENTICATION stage and no loading is in progress
      if (!isStaticLoading && !isDynamicLoading && activeRequestsCount === 0) {
        console.log('LoadingContext: Resetting to AUTHENTICATION stage due to navigation', {
          currentStage,
          isStaticLoading,
          isDynamicLoading,
          activeRequests: activeRequestsCount
        });
        setStageInternal(LoadingStage.AUTHENTICATION);
      } else {
        console.log('LoadingContext: Skipping navigation reset - loading in progress', {
          currentStage,
          isStaticLoading,
          isDynamicLoading,
          activeRequests: activeRequestsCount
        });
      }
    };

    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, [currentStage, isStaticLoading, isDynamicLoading, activeRequestsCount, setStageInternal]);

  const loadingContextValue = useMemo(
    () => ({
      isStaticLoading,
      isDynamicLoading,
      setStaticLoading,
      setDynamicLoading,
      resetLoading,
      currentStage,
      setStage: setStageInternal
    }),
    [
      isStaticLoading,
      isDynamicLoading,
      setStaticLoading,
      setDynamicLoading,
      resetLoading,
      currentStage,
      setStageInternal
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