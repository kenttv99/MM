"use client";
import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

// Интерфейс для окна с состоянием загрузки
interface WindowWithLoadingStage extends Window {
  __loading_stage__?: LoadingStage;
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
  
  // Особый случай: Разрешаем переход из ERROR в начальную стадию AUTHENTICATION при сбросе ошибки
  if (currentStage === LoadingStage.ERROR && newStage === LoadingStage.AUTHENTICATION) {
    stageLogger.info('Allowing exit from ERROR state to AUTHENTICATION for recovery', { 
      from: currentStage, 
      to: newStage
    });
    return { allowed: true, reason: 'Error state recovery' };
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
    case LoadingStage.COMPLETED: return 3;
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

// Максимальный размер истории переходов
const MAX_HISTORY_SIZE = 30;

// Provider component
export const LoadingStageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStage, setCurrentStageState] = useState<LoadingStage>(LoadingStage.INITIAL);
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([
    { stage: LoadingStage.INITIAL, timestamp: Date.now() }
  ]);
  const stageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useIsMounted();
  
  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (stageTimeoutRef.current) {
        clearTimeout(stageTimeoutRef.current);
        stageTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Логируем изменения стадии в глобальный объект window для отладки
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as WindowWithLoadingStage).__loading_stage__ = currentStage;
    }
  }, [currentStage]);
  
  // Метод установки новой стадии загрузки с валидацией перехода
  const setStage = useCallback((stage: LoadingStage, isUnauthorizedResponse: boolean = false) => {
    if (!isMounted.current) return;

    // Валидация перехода
    const { allowed, reason } = canChangeStage(currentStage, stage, stageHistory, isUnauthorizedResponse);

    if (allowed) {
      stageLogger.info('Changing loading stage', { 
        from: currentStage, 
        to: stage,
        reason
      });
      
      setCurrentStageState(stage);
      
      // Обновление истории стадий
      setStageHistory(prevHistory => {
        const newHistory = [
          ...prevHistory,
          { stage, timestamp: Date.now() }
        ];
        // Ограничиваем размер истории
        return newHistory.length > MAX_HISTORY_SIZE ? newHistory.slice(-MAX_HISTORY_SIZE) : newHistory;
      });
      
      // Отправка события об изменении стадии
      dispatchStageChangeEvent(stage);
      
    } else {
      stageLogger.warn('Stage change prevented', { 
        from: currentStage, 
        to: stage, 
        reason 
      });
    }
  }, [currentStage, stageHistory, isMounted]); // Обновляем зависимости useCallback

  // Эффект для автоматического перехода из INITIAL в AUTHENTICATION
  useEffect(() => {
    if (currentStage === LoadingStage.INITIAL) {
      const initialTimer = setTimeout(() => {
        // Проверяем еще раз, не изменилась ли стадия
        if (isMounted.current && currentStage === LoadingStage.INITIAL) {
          stageLogger.info('Automatically transitioning from INITIAL to AUTHENTICATION');
          setStage(LoadingStage.AUTHENTICATION);
        }
      }, 50); // Небольшая задержка
      
      return () => clearTimeout(initialTimer);
    }
  }, [currentStage, setStage, isMounted]); // Теперь зависимости корректны
  
  // Обработчик завершения проверки аутентификации
  useEffect(() => {
    const handleAuthCheckComplete = (event: CustomEvent) => {
      const { isAuthenticated } = event.detail || {};
      if (!isMounted.current) return;
      stageLogger.info('Auth check completed', { isAuthenticated });
      setStage(LoadingStage.STATIC_CONTENT);
    };
    window.addEventListener('auth-check-complete', handleAuthCheckComplete as EventListener);
    return () => {
      window.removeEventListener('auth-check-complete', handleAuthCheckComplete as EventListener);
    };
  }, [isMounted, setStage]);
  
  // Новый обработчик: переход к DYNAMIC_CONTENT после полной инициализации профиля
  useEffect(() => {
    const handleProfileLoaded = () => {
      if (currentStage < LoadingStage.DYNAMIC_CONTENT) {
        setStage(LoadingStage.DYNAMIC_CONTENT);
      }
    };
    window.addEventListener('profile-loaded', handleProfileLoaded);
    return () => window.removeEventListener('profile-loaded', handleProfileLoaded);
  }, [currentStage, setStage]);
  
  // Обработчик ошибок загрузки
  useEffect(() => {
    const handleLoadingError = (event: CustomEvent) => {
      const { error } = event.detail || {};
      
      if (!isMounted.current) return;
      
      stageLogger.error('Loading error detected', { error });
      
      // При ошибке переходим в состояние ERROR
      setStage(LoadingStage.ERROR);
    };
    
    window.addEventListener('loading-error', handleLoadingError as EventListener);
    
    return () => {
      window.removeEventListener('loading-error', handleLoadingError as EventListener);
    };
  }, [isMounted, setStage]);
  
  // Формируем значение контекста
  const contextValue = useMemo(() => ({
    currentStage,
    setStage,
    stageHistory,
    // Для совместимости с типом, не используются в новой архитектуре
    isAuthChecked: false,
    setIsAuthChecked: () => {},
  }), [currentStage, setStage, stageHistory]);
  
  useEffect(() => {
    console.warn('LOADING_STAGE_PROVIDER: mounted');
    return () => {
      console.warn('LOADING_STAGE_PROVIDER: unmounted');
    };
  }, []);
  
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
  return context as Omit<LoadingStageContextType, 'isAuthChecked' | 'setIsAuthChecked'>;
} 