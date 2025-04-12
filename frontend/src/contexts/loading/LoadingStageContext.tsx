"use client";
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { createLogger } from "@/utils/logger";
import { LoadingStage, LoadingStageContextType, StageChangeResult, StageHistoryEntry } from '@/contexts/loading/types';

// Create a namespace-specific logger
const stageLogger = createLogger('LoadingStageContext');

// Custom hook for tracking mounted state
export function useIsMounted() {
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  return isMounted;
}

// Интерфейс для окна с режимом отладки
interface WindowWithDebug extends Window {
  DEBUG_LOADING_CONTEXT?: boolean;
}

// Helper function to check stage transitions
export function canChangeStage(
  currentStage: LoadingStage, 
  newStage: LoadingStage, 
  stageHistory: StageHistoryEntry[],
  isUnauthorizedResponse: boolean = false
): StageChangeResult {
  // Проверка режима отладки - если установлен, всегда разрешаем переходы
  if (typeof window !== 'undefined' && (window as WindowWithDebug).DEBUG_LOADING_CONTEXT) {
    stageLogger.info('Debug mode enabled, allowing stage transition', { from: currentStage, to: newStage });
    return { allowed: true };
  }
  
  // Особая обработка для входа - всегда разрешаем переход на STATIC_CONTENT при авторизации
  if (newStage === LoadingStage.STATIC_CONTENT && currentStage === LoadingStage.AUTHENTICATION) {
    stageLogger.info('Allowing transition from AUTHENTICATION to STATIC_CONTENT', { 
      from: currentStage, 
      to: newStage,
      reason: 'critical_auth_flow'
    });
    return { allowed: true };
  }

  // Особая обработка для переходов между INITIAL и другими стадиями - всегда разрешаем
  // НО - если и текущая, и новая стадия INITIAL, то не разрешаем (это создает цикл)
  if ((currentStage === LoadingStage.INITIAL && newStage !== LoadingStage.INITIAL) || 
      (newStage === LoadingStage.INITIAL && currentStage !== LoadingStage.INITIAL)) {
    stageLogger.info('Allowing transition involving INITIAL stage', { 
      from: currentStage, 
      to: newStage
    });
    return { allowed: true };
  }
  
  // ВАЖНО: Добавляем явную проверку на цикл INITIAL->INITIAL
  if (currentStage === LoadingStage.INITIAL && newStage === LoadingStage.INITIAL) {
    return { 
      allowed: false, 
      reason: 'Preventing INITIAL->INITIAL cycle'
    };
  }
  
  // Добавляем расширенное обнаружение циклов
  // Ищем шаблоны повторяющихся последовательностей переходов
  const now = Date.now();
  const recentHistory = stageHistory
    .filter(entry => now - entry.timestamp < 3000) // Последние 3 секунды
    .map(entry => entry.stage);
  
  // Проверяем паттерны циклических изменений (A->B->A->B...)
  if (recentHistory.length >= 4) {
    // Проверка на общий цикл между двумя стадиями
    let cycleDetected = false;
    let cycleStages: LoadingStage[] = [];
    
    // Проверяем последние 4 перехода
    const last4 = recentHistory.slice(-4);
    
    // Проверка на паттерн A-B-A-B
    if (last4[0] === last4[2] && last4[1] === last4[3] && 
        last4[0] !== last4[1]) {
      cycleDetected = true;
      cycleStages = [last4[0], last4[1]];
    }
    
    // Проверка на паттерн A-B-C-A-B-C
    if (recentHistory.length >= 6) {
      const last6 = recentHistory.slice(-6);
      if (last6[0] === last6[3] && last6[1] === last6[4] && 
          last6[2] === last6[5] && 
          !(last6[0] === last6[1] && last6[1] === last6[2])) {
        cycleDetected = true;
        cycleStages = [last6[0], last6[1], last6[2]];
      }
    }
    
    if (cycleDetected) {
      stageLogger.warn('Detected stage transition cycle', {
        cycle: cycleStages,
        currentStage,
        newStage,
        recentHistory
      });
      
      // Если цикл включает стадию INITIAL или AUTHENTICATION, 
      // то разрешаем переход только на STATIC_CONTENT
      if (cycleStages.includes(LoadingStage.INITIAL) || 
          cycleStages.includes(LoadingStage.AUTHENTICATION)) {
        
        if (newStage === LoadingStage.STATIC_CONTENT) {
          stageLogger.info('Breaking cycle by allowing transition to STATIC_CONTENT');
          return { allowed: true, reason: 'Breaking cycle by advancing to STATIC_CONTENT' };
        }
        
        return {
          allowed: false,
          reason: 'Cycle detected, only transition to STATIC_CONTENT is allowed'
        };
      }
      
      return {
        allowed: false,
        reason: 'Stage change cycle detected'
      };
    }
  }
  
  // 1. Prevent regression to AUTHENTICATION after higher stages,
  // unless it's an unauthorized response (401)
  if (newStage === LoadingStage.AUTHENTICATION) {
    // Check if we've been on a higher stage
    const hasBeenPastAuth = stageHistory.some(
      entry => entry.stage !== LoadingStage.AUTHENTICATION && 
              entry.stage !== LoadingStage.INITIAL
    );
    
    // If this is a 401 response, allow regression
    if (hasBeenPastAuth && !isUnauthorizedResponse) {
      return { 
        allowed: false, 
        reason: 'Regression to AUTHENTICATION after higher stages is not allowed' 
      };
    } else if (hasBeenPastAuth && isUnauthorizedResponse) {
      stageLogger.info('Allowing regression to AUTHENTICATION due to unauthorized response');
    }
  }
  
  // 2. Check for stage change cycles
  const recentSameStageChanges = stageHistory
    .filter(entry => entry.stage === newStage && now - entry.timestamp < 2000)
    .length;
  
  if (recentSameStageChanges >= 3) {
    return { 
      allowed: false, 
      reason: 'Too many rapid changes to the same stage, potential cycle detected' 
    };
  }
  
  // 3. Skip if stage hasn't changed
  if (newStage === currentStage) {
    return { 
      allowed: false, 
      reason: 'Stage is already set to this value' 
    };
  }
  
  // Transition allowed
  return { allowed: true };
}

// Helper to get stage level (higher number = later stage)
export function getStageLevel(stage: LoadingStage): number {
  switch (stage) {
    case LoadingStage.AUTHENTICATION: return 0;
    case LoadingStage.STATIC_CONTENT: return 1;
    case LoadingStage.DYNAMIC_CONTENT: return 2;
    case LoadingStage.DATA_LOADING: return 3;
    case LoadingStage.COMPLETED: return 4;
    default: return -1;
  }
}

// Function to dispatch stage change event
export function dispatchStageChangeEvent(stage: LoadingStage) {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('loadingStageChange', {
    detail: { stage }
  });
  
  window.dispatchEvent(event);
  stageLogger.debug('Dispatched stage change event', { stage });
}

// Create context
const LoadingStageContext = createContext<LoadingStageContextType | undefined>(undefined);

// Provider component
export const LoadingStageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStage, setCurrentStage] = useState<LoadingStage>(LoadingStage.INITIAL);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([]);
  const isMounted = useIsMounted();
  const stageTransitionTimerId = useRef<NodeJS.Timeout | null>(null);
  const initialSetupDoneRef = useRef<boolean>(false);
  
  // Set stage with validation
  const setStage = useCallback((newStage: LoadingStage, isUnauthorizedResponse: boolean = false) => {
    const result = canChangeStage(currentStage, newStage, stageHistory, isUnauthorizedResponse);
    
    if (!result.allowed) {
      stageLogger.warn(`Stage change not allowed: ${result.reason}`, { 
        currentStage, 
        attemptedStage: newStage,
        history: stageHistory.slice(-3) 
      });
      return;
    }
    
    stageLogger.info('Changing loading stage', { from: currentStage, to: newStage });
    
    // Update stage
    setCurrentStage(newStage);
    
    // Add to history
    const now = Date.now();
    setStageHistory(prev => {
      const updated = [...prev, { stage: newStage, timestamp: now }];
      // Keep last 10 entries
      return updated.length > 10 ? updated.slice(-10) : updated;
    });
    
    // Dispatch event
    dispatchStageChangeEvent(newStage);
    
    // Clear existing auto-progress timer
    if (stageTransitionTimerId.current) {
      clearTimeout(stageTransitionTimerId.current);
      stageTransitionTimerId.current = null;
    }
    
    // Set auto-progress timer for certain stages
    if (newStage !== LoadingStage.COMPLETED && 
        newStage !== LoadingStage.ERROR) {
      stageTransitionTimerId.current = setTimeout(() => {
        if (!isMounted.current) return;
        
        stageLogger.warn('Auto-progressing stage due to timeout', { 
          from: newStage 
        });
        
        // Progress to next stage after timeout
        switch (newStage) {
          case LoadingStage.AUTHENTICATION:
            if (currentStage !== LoadingStage.STATIC_CONTENT) {
              setStage(LoadingStage.STATIC_CONTENT);
            }
            break;
          case LoadingStage.STATIC_CONTENT:
            if (currentStage !== LoadingStage.DYNAMIC_CONTENT) {
              setStage(LoadingStage.DYNAMIC_CONTENT);
            }
            break;
          case LoadingStage.DYNAMIC_CONTENT:
            if (currentStage !== LoadingStage.DATA_LOADING) {
              setStage(LoadingStage.DATA_LOADING);
            }
            break;
          case LoadingStage.DATA_LOADING:
            if (currentStage !== LoadingStage.COMPLETED) {
              setStage(LoadingStage.COMPLETED);
            }
            break;
          case LoadingStage.INITIAL:
            // Разорвать потенциальный цикл - проверяем, чтобы не переходить снова к INITIAL
            if (currentStage !== LoadingStage.INITIAL && currentStage !== LoadingStage.AUTHENTICATION) {
              setStage(LoadingStage.AUTHENTICATION);
            }
            break;
        }
      }, 5000); // 5 second timeout for auto-progression
    }
  }, [currentStage, stageHistory, isMounted]);
  
  // Добавляем обработчик события для сброса истории состояний
  useEffect(() => {
    const handleResetStageHistory = (event: CustomEvent) => {
      stageLogger.info('Resetting stage history', event.detail);
      
      // Проверяем, если история уже очищена и содержит только текущее состояние,
      // то нет необходимости делать новый setState (предотвращает лишние перерисовки)
      if (stageHistory.length === 1 && stageHistory[0].stage === currentStage) {
        stageLogger.info('Stage history already clean, skipping update');
        return;
      }
      
      // Сбрасываем историю переходов, оставляя только текущее состояние
      const now = Date.now();
      setStageHistory([{ stage: currentStage, timestamp: now }]);
    };
    
    window.addEventListener('reset-stage-history', handleResetStageHistory as EventListener);
    
    return () => {
      window.removeEventListener('reset-stage-history', handleResetStageHistory as EventListener);
    };
  }, [currentStage, stageHistory]); // Добавляем stageHistory как зависимость
  
  // Заменяем эффект инициализации на безопасную версию с использованием ref
  useEffect(() => {
    if (!initialSetupDoneRef.current) {
      initialSetupDoneRef.current = true;
      stageLogger.info('Performing one-time initial stage setup');
      
      // Устанавливаем начальную стадию AUTHENTICATION напрямую
      // минуя цикл через INITIAL
      const now = Date.now();
      setCurrentStage(LoadingStage.AUTHENTICATION);
      setStageHistory([{ stage: LoadingStage.AUTHENTICATION, timestamp: now }]);
      
      // Диспатчим событие изменения стадии
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('loadingStageChange', {
          detail: { stage: LoadingStage.AUTHENTICATION }
        }));
      }
    }
    
    return () => {
      if (stageTransitionTimerId.current) {
        clearTimeout(stageTransitionTimerId.current);
      }
    };
  }, []); // Пустой массив зависимостей означает, что эффект выполнится только при монтировании
  
  // Context value
  const contextValue: LoadingStageContextType = {
    currentStage,
    setStage,
    stageHistory,
    isAuthChecked, 
    setIsAuthChecked
  };
  
  return (
    <LoadingStageContext.Provider value={contextValue}>
      {children}
    </LoadingStageContext.Provider>
  );
};

// Hook to use the loading stage context
export function useLoadingStage() {
  const context = useContext(LoadingStageContext);
  if (!context) {
    throw new Error("useLoadingStage must be used within a LoadingStageProvider");
  }
  return context;
} 