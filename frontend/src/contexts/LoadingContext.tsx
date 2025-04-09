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
  COMPLETED = 'completed',
  INITIAL = 'initial',
  AUTH_CHECK = 'auth_check',
  COMPLETE = 'complete',
  ERROR = 'error'
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
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  error: string | null;
  setError: (error: string | null) => void;
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
  const [stage, setStage] = useState<LoadingStage>(LoadingStage.INITIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const pathname = usePathname();
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
  // New ref for navigation reset timer
  const navigationResetTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const safeSetState = useCallback(() => {
    if (isMounted.current) {
      // Don't reset state if there are active requests on events page
      if (!isLoading && isEventsPage.current && activeRequestsCount > 0) {
        return;
      }
      
      loadingStateRef.current = {
        ...loadingStateRef.current,
        isStaticLoading: isLoading,
        isDynamicLoading: isLoading
      };
    }
  }, [isLoading]);

  // Function for setting static loading
  const setStaticLoading = useCallback((isLoading: boolean) => {
    // Логируем только при изменении состояния
    if (loadingStateRef.current.isStaticLoading !== isLoading) {
      logInfo('Setting static loading', { isLoading, stage });
    }
    
    // Проверяем админский маршрут
    const isAdminRoute = pathname?.startsWith('/admin');
    
    // Особое поведение для админских маршрутов
    if (isAdminRoute) {
      if (isLoading) {
        // Если админский маршрут, сразу устанавливаем STATIC_CONTENT,
        // но не обновляем флаг isStaticLoading если мы на более высокой стадии
        if (stage === LoadingStage.AUTHENTICATION || stage === LoadingStage.INITIAL) {
          setStage(LoadingStage.STATIC_CONTENT);
          
          // Ускоренный переход для админских маршрутов - сразу запускаем переход к COMPLETED
          requestAnimationFrame(() => {
            if (isMounted.current) {
              setStage(LoadingStage.COMPLETED);
              loadingStateRef.current.isStaticLoading = false;
            }
          });
        } else if (stage === LoadingStage.STATIC_CONTENT) {
          // Если мы на STATIC_CONTENT, обновляем флаг, но добавляем таймер для автоматического перехода
          loadingStateRef.current.isStaticLoading = isLoading;
          
          if (!stageTransitionTimerRef.current) {
            // Сразу запускаем переход на COMPLETED без задержки для админского маршрута
            setStage(LoadingStage.COMPLETED);
            loadingStateRef.current.isStaticLoading = false;
            
            // Очищаем существующий таймер, если есть
            if (stageTransitionTimerRef.current) {
              clearTimeout(stageTransitionTimerRef.current);
              stageTransitionTimerRef.current = null;
            }
          }
        } else {
          // На более высоких стадиях просто игнорируем флаг
          loadingStateRef.current.isStaticLoading = false;
          return;
        }
      } else {
        // Если снимаем флаг загрузки на админском маршруте, форсируем переход к COMPLETED
        // если мы были на STATIC_CONTENT или выше
        if (stage !== LoadingStage.AUTHENTICATION && stage !== LoadingStage.INITIAL) {
          // Немедленно переводим к COMPLETED минуя промежуточные стадии
          loadingStateRef.current.isStaticLoading = false;
          loadingStateRef.current.isDynamicLoading = false;
          setStage(LoadingStage.COMPLETED);
        }
      }
    } else {
      // Стандартное поведение для не-админских маршрутов
      if (isLoading && stage === LoadingStage.AUTHENTICATION) {
        setStage(LoadingStage.STATIC_CONTENT);
      }
      loadingStateRef.current.isStaticLoading = isLoading;
    }
    
    safeSetState();
  }, [safeSetState, stage, pathname]);

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
      logInfo('Setting dynamic loading', { isLoading, stage });
    }
    
    if (isLoading) {
      activeRequestsCount++;
      if (stage === LoadingStage.STATIC_CONTENT) {
        setStage(LoadingStage.DYNAMIC_CONTENT);
      }
    } else {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1);
      if (activeRequestsCount === 0 && stage === LoadingStage.DYNAMIC_CONTENT) {
        setStage(LoadingStage.DATA_LOADING);
      }
    }
    safeSetState();
  }, [safeSetState, stage]);

  // Function for resetting loading state
  const resetLoading = useCallback(() => {
    const now = Date.now();
    if (now - lastResetRef.current < RESET_DEBOUNCE) {
      // Убираем избыточные логи для дебаунса
      return;
    }
    
    // Don't reset during authentication stage
    if (stage === LoadingStage.AUTHENTICATION) {
      console.log('LoadingContext: Skipping reset during authentication stage');
      return;
    }
    
    lastResetRef.current = now;
    lastResetTime = now;
    
    console.log('LoadingContext: Resetting loading state', {
      activeRequests: activeRequestsCount,
      stage
    });
    
    if (isMounted.current) {
      // Don't reset state if there are active requests on events page
      if (isEventsPage.current && activeRequestsCount > 0) {
        // Убираем лишние логи
        return;
      }
      
      setIsLoading(false);
      loadingStateRef.current = { isStaticLoading: false, isDynamicLoading: false };
      activeRequestsCount = 0;
      
      // Reset stage to COMPLETED when all loading is done
      const stageLevel = getStageLevel(stage as LoadingStage);
      if (stageLevel !== -1 && stageLevel !== 4) {
        setStage(LoadingStage.COMPLETED);
      }
    }
  }, [stage, getStageLevel]);
  
  // Internal function to set stage that handles stage change history and other logic
  const updateStage = useCallback((newStage: LoadingStage) => {
    if (!isMounted.current) {
      return;
    }
    
    // Обнаружение циклов установки одной и той же стадии
    const now = Date.now();
    const recentSameStageChanges = stageChangeHistoryRef.current
      .filter(entry => entry.stage === newStage && now - entry.timestamp < 2000)
      .length;
    
    // Если часто повторяем одну и ту же стадию, это может быть цикл
    if (recentSameStageChanges >= 3) {
      logWarn('Detected potential stage change loop', {
        stage: newStage,
        recentChanges: recentSameStageChanges,
        history: [...stageChangeHistoryRef.current]
      });
      return; // Прерываем цикл, не устанавливая стадию
    }
    
    // Особая обработка возвратов к стадии AUTHENTICATION
    if (newStage === LoadingStage.AUTHENTICATION) {
      // Проверяем, были ли мы на более высокой стадии  
      const hasBeenPastAuth = stageChangeHistoryRef.current.some(
        entry => entry.stage !== LoadingStage.AUTHENTICATION && 
                entry.stage !== LoadingStage.INITIAL
      );
      
      if (hasBeenPastAuth) {
        logWarn('Preventing regression to AUTHENTICATION after being at higher stages', {
          currentStage: stage,
          history: [...stageChangeHistoryRef.current]
        });
        return; // Просто блокируем без перенаправления
      }
    }
    
    // Пропускаем установку, если стадия не изменилась
    if (newStage === stage) {
      return;
    }
    
    // Улучшенное логирование для отладки
    logInfo('Setting stage', { 
      newStage, 
      prevStage: stage,
      history: [...stageChangeHistoryRef.current]
    });
    
    // Обновляем состояние
    previousStageRef.current = stage;
    setStage(newStage);
    
    // Отправляем событие изменения стадии
    dispatchStageChangeEvent(newStage, stageChangeHistoryRef);
    
    // Automatically progress to next stage after a timeout if stuck
    if (stageTransitionTimerRef.current) {
      clearTimeout(stageTransitionTimerRef.current);
    }
    
    // Set a timeout to auto-progress if needed
    if (newStage !== LoadingStage.COMPLETED) {
      stageTransitionTimerRef.current = setTimeout(() => {
        // If we're still in the same stage after the timeout, move to the next one
        if (isMounted.current && stage === newStage) {
          console.log('LoadingContext: Auto-progressing stage', { from: stage });
          switch (stage) {
            case LoadingStage.AUTHENTICATION:
              // Для стадии аутентификации просто переходим к следующей стадии
              // после таймаута, AuthContext сам разберется с проверкой
              setStage(LoadingStage.STATIC_CONTENT);
              break;
            case LoadingStage.STATIC_CONTENT:
              setStage(LoadingStage.DYNAMIC_CONTENT);
              break;
            case LoadingStage.DYNAMIC_CONTENT:
              setStage(LoadingStage.DATA_LOADING);
              break;
            case LoadingStage.DATA_LOADING:
              setStage(LoadingStage.COMPLETED);
              break;
          }
        }
      }, 5000); // 5 second timeout for auto-progression
    }
  }, [stage]);

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
    
    // Устанавливаем начальную стадию и логируем это
    setStage(LoadingStage.AUTHENTICATION);
    previousStageRef.current = LoadingStage.AUTHENTICATION;
    dispatchStageChangeEvent(LoadingStage.AUTHENTICATION, stageChangeHistoryRef);
    
    // Добавляем обработчик события для синхронизации с AuthContext
    const handleAuthStageChange = (event: CustomEvent) => {
      if (event.detail && event.detail.stage) {
        const authStage = event.detail.stage;
        if (authStage === LoadingStage.STATIC_CONTENT && stage === LoadingStage.INITIAL) {
          logInfo('Syncing with AuthContext stage', { authStage, currentStage: stage });
          setStage(LoadingStage.STATIC_CONTENT);
        }
      }
    };
    
    window.addEventListener('auth-stage-change', handleAuthStageChange as EventListener);
    
    return () => {
      isMounted.current = false;
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      if (uiLockTimerRef.current) clearTimeout(uiLockTimerRef.current);
      if (spinnerCheckIntervalRef.current) clearInterval(spinnerCheckIntervalRef.current);
      if (stageTransitionTimerRef.current) clearTimeout(stageTransitionTimerRef.current);
      window.removeEventListener('auth-stage-change', handleAuthStageChange as EventListener);
      activeRequestsCount = 0;
    };
  }, [pathname]);

  // Effect for tracking path
  useEffect(() => {
    if (!isInitialized.current) {
      return;
    }
    
    isEventsPage.current = pathname?.includes('/events');
    const isAdminRoute = pathname?.startsWith('/admin');
    
    // Блокируем сбросы на админских маршрутах и на странице событий
    if (isEventsPage.current || isAdminRoute) {
      logDebug('Skipping reset on special route', { pathname, isEventsPage: isEventsPage.current, isAdminRoute });
      return;
    }
    
    // Используем debounce для предотвращения множественных сбросов при быстрой навигации
    if (navigationResetTimerRef.current) {
      clearTimeout(navigationResetTimerRef.current);
    }
    
    // Отложенный сброс стадии при навигации
    navigationResetTimerRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      
      resetLoading();
      
      // Проверяем через глобальную историю стадий
      const hasBeenPastAuth = stageChangeHistoryRef.current.some(entry => entry.stage !== 'authentication');
      
      // Никогда не сбрасываем до AUTHENTICATION, если мы уже были на других стадиях
      if (hasBeenPastAuth) {
        logDebug('Skipping reset to AUTHENTICATION stage - already been past auth', { 
          currentStage: stage, 
          hasBeenPastAuth,
          stageHistory: stageChangeHistoryRef.current 
        });
        return;
      }
      
      // Проверяем, можно ли безопасно сбросить до AUTHENTICATION
      const canResetToAuth = 
        // Если мы и так в стадии аутентификации, то можно просто обновить
        stage === 'authentication' || 
        // Если нет активных загрузок, то можно сбросить
        (!loadingStateRef.current.isStaticLoading && 
         !loadingStateRef.current.isDynamicLoading && 
         activeRequestsCount === 0);
      
      if (canResetToAuth) {
        logInfo('Resetting to AUTHENTICATION stage on navigation', { 
          currentStage: stage, 
          pathname,
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount
        });
        
        // Reset to authentication stage on navigation
        updateStage(LoadingStage.AUTHENTICATION);
        
        // Reset stage change history
        stageChangeHistoryRef.current = [{
          stage: LoadingStage.AUTHENTICATION,
          timestamp: Date.now()
        }];
      } else {
        logDebug('Skipping reset to AUTHENTICATION stage', { 
          currentStage: stage, 
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount,
          pathname 
        });
      }
    }, 100); // Небольшая задержка для предотвращения частых сбросов
    
    return () => {
      if (navigationResetTimerRef.current) {
        clearTimeout(navigationResetTimerRef.current);
      }
    };
  }, [pathname, stage, resetLoading, updateStage]);

  // Effect for auto-reset state
  useEffect(() => {
    if (loadingStateRef.current.isStaticLoading || loadingStateRef.current.isDynamicLoading) {
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
  }, [loadingStateRef.current.isStaticLoading, loadingStateRef.current.isDynamicLoading, resetLoading]);

  // Effect for preventing UI lock
  useEffect(() => {
    if (loadingStateRef.current.isStaticLoading || loadingStateRef.current.isDynamicLoading) {
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
  }, [loadingStateRef.current.isStaticLoading, loadingStateRef.current.isDynamicLoading, resetLoading]);

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
        
        if (hasSpinner && !loadingStateRef.current.isStaticLoading) {
          setStaticLoading(true);
        } else if (!hasSpinner && loadingStateRef.current.isStaticLoading) {
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
  }, [loadingStateRef.current.isStaticLoading, setStaticLoading]);

  // Effect for handling stage changes
  useEffect(() => {
    // If we were at a stage higher than AUTHENTICATION, remember this
    if (stage !== LoadingStage.AUTHENTICATION) {
      hasBeenPastAuthenticationRef.current = true;
    }
    
    // Determine if we're in a regression state (transition from higher stage to lower)
    const prevStage = stageChangeHistoryRef.current.length > 0 ? 
      stageChangeHistoryRef.current[stageChangeHistoryRef.current.length - 1].stage : 
      null;
    const isRegression = prevStage && getStageLevel(stage) < getStageLevel(prevStage as LoadingStage);
    
    // Add additional check to exclude false triggers
    const isPossibleFalseRegression = stageChangeHistoryRef.current.length <= 2 || 
                                     Date.now() - lastResetRef.current < 500;
    
    // Special handling for events page
    if (isEventsPage.current) {
      // If we're on the events page and in AUTHENTICATION stage, force progress to STATIC_CONTENT
      if (stage === LoadingStage.AUTHENTICATION) {
        logInfo('Events page detected in AUTHENTICATION stage, progressing to STATIC_CONTENT');
        // Use a shorter timeout for events page to improve loading speed
        setTimeout(() => {
          if (isMounted.current && stage === LoadingStage.AUTHENTICATION) {
            updateStage(LoadingStage.STATIC_CONTENT);
          }
        }, 100);
        return;
      }
      
      // If we're on events page and have active requests, ensure we're at least at STATIC_CONTENT
      if (activeRequestsCount > 0 && getStageLevel(stage) < getStageLevel(LoadingStage.STATIC_CONTENT)) {
        logInfo('Events page has active requests but low stage, progressing to STATIC_CONTENT');
        updateStage(LoadingStage.STATIC_CONTENT);
        return;
      }
    }
    
    // If this is a regression to AUTHENTICATION, log warning
    if (isRegression && stage === LoadingStage.AUTHENTICATION && 
        stageChangeHistoryRef.current.length > 2 && !isPossibleFalseRegression) {
      logWarn('Detected regression to AUTHENTICATION, forcing STATIC_CONTENT', {
        stageHistory: [...stageChangeHistoryRef.current]
      });
      
      setTimeout(() => {
        if (isMounted.current) {
          updateStage(LoadingStage.STATIC_CONTENT);
        }
      }, 0);
      return;
    }
    
    // Log stage change for statistics
    logDebug('Stage changed', {
      currentStage: stage,
      isStaticLoading: loadingStateRef.current.isStaticLoading,
      isDynamicLoading: loadingStateRef.current.isDynamicLoading,
      activeRequests: activeRequestsCount
    });
    
  }, [stage, loadingStateRef.current.isStaticLoading, loadingStateRef.current.isDynamicLoading, getStageLevel]);

  // Effect for handling navigation
  useEffect(() => {
    const handleNavigation = () => {
      // Проверяем через глобальную историю стадий
      const hasBeenPastAuth = stageChangeHistoryRef.current.some(entry => entry.stage !== 'authentication');
      
      // Не сбрасываем до AUTHENTICATION, если мы уже были на другой стадии
      if (hasBeenPastAuth) {
        console.log('LoadingContext: Skipping navigation reset - already been past AUTHENTICATION stage', {
          currentStage: stage,
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount,
          stageHistory: stageChangeHistoryRef.current
        });
        return;
      }
      
      // Don't reset to AUTHENTICATION if we're already past it
      // Используем строковое сравнение, чтобы избежать проблем с типизацией
      if (stage !== 'authentication') {
        console.log('LoadingContext: Skipping navigation reset - already past AUTHENTICATION stage', {
          currentStage: stage,
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount
        });
        return;
      }

      // Only reset if we're in AUTHENTICATION stage and no loading is in progress
      if (!loadingStateRef.current.isStaticLoading && !loadingStateRef.current.isDynamicLoading && activeRequestsCount === 0) {
        console.log('LoadingContext: Resetting to AUTHENTICATION stage due to navigation', {
          currentStage: stage,
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount
        });
        updateStage(LoadingStage.AUTHENTICATION);
      } else {
        console.log('LoadingContext: Skipping navigation reset - loading in progress', {
          currentStage: stage,
          isStaticLoading: loadingStateRef.current.isStaticLoading,
          isDynamicLoading: loadingStateRef.current.isDynamicLoading,
          activeRequests: activeRequestsCount
        });
      }
    };

    // Add event listener for page reload
    const handlePageReload = () => {
      console.log('LoadingContext: Page reload detected');
      
      // Check if we have a token in localStorage
      const hasToken = typeof window !== 'undefined' && localStorage.getItem('token') !== null;
      
      if (hasToken) {
        console.log('LoadingContext: Token found in localStorage, preserving authentication state');
        // If we have a token, don't reset to AUTHENTICATION stage
        if (stage === LoadingStage.AUTHENTICATION) {
          console.log('LoadingContext: Forcing transition to STATIC_CONTENT on reload with token');
          updateStage(LoadingStage.STATIC_CONTENT);
        }
      }
    };
    
    // Add event listener for logout
    const handleLogout = () => {
      console.log('LoadingContext: Logout event detected');
      // Reset stage change history on logout
      stageChangeHistoryRef.current = [{
        stage: LoadingStage.AUTHENTICATION,
        timestamp: Date.now()
      }];
    };

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('load', handlePageReload);
    window.addEventListener('authStateChanged', (event: any) => {
      if (event.detail && event.detail.isAuth === false) {
        handleLogout();
      }
    });
    
    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('load', handlePageReload);
      window.removeEventListener('authStateChanged', handleLogout as EventListener);
    };
  }, [stage, loadingStateRef.current.isStaticLoading, loadingStateRef.current.isDynamicLoading, activeRequestsCount, updateStage]);

  const value = useMemo(() => ({
    isStaticLoading: loadingStateRef.current.isStaticLoading,
    isDynamicLoading: loadingStateRef.current.isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    resetLoading,
    currentStage: stage,
    setStage: updateStage,
    isLoading,
    setIsLoading,
    progress,
    setProgress,
    error,
    setError
  }), [
    loadingStateRef.current.isStaticLoading,
    loadingStateRef.current.isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    resetLoading,
    stage,
    updateStage,
    isLoading,
    progress,
    error
  ]);

  return (
    <LoadingContext.Provider value={value}>
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