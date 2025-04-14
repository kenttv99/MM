"use client";
import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { createLogger } from "@/utils/logger";
import { LoadingStageProvider, useLoadingStage } from './LoadingStageContext';
import { LoadingFlagsProvider, useLoadingFlags } from './LoadingFlagsContext';
import { LoadingProgressProvider, useLoadingProgress } from './LoadingProgressContext';
import { LoadingErrorProvider, useLoadingError } from './LoadingErrorContext';
import { LoadingContextType, LoadingStage } from './types';

// Create namespace-specific logger
const loadingLogger = createLogger('LoadingContextProvider');

// Create combined context
const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Interval for inconsistency checks (milliseconds)
const INCONSISTENCY_CHECK_INTERVAL = 2000;

// Combined provider component
export const LoadingContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <LoadingStageProvider>
      <LoadingFlagsProvider>
        <LoadingProgressProvider>
          <LoadingErrorProvider>
            <InnerProvider>
              {children}
            </InnerProvider>
          </LoadingErrorProvider>
        </LoadingProgressProvider>
      </LoadingFlagsProvider>
    </LoadingStageProvider>
  );
};

// Inner provider with actual implementation
const InnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get data from all sub-contexts
  const { currentStage, setStage, isAuthChecked, setIsAuthChecked } = useLoadingStage();
  const { isStaticLoading, isDynamicLoading, setStaticLoading, setDynamicLoading, resetLoading } = useLoadingFlags();
  const { progress, setProgress } = useLoadingProgress();
  const { error, setError, clearError } = useLoadingError();
  const stageTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Реф для тайм-аута стадий

  // Function to detect and fix loading inconsistencies
  const detectAndFixLoadingInconsistency = useCallback((): boolean => {
    // Активные запросы из глобального состояния
    const activeRequests = typeof window !== 'undefined' ? window.__activeRequestCount || 0 : 0;
    let inconsistencyDetected = false;
    
    // Несогласованность 1: Флаги загрузки активны, но нет активных запросов
    if ((isStaticLoading || isDynamicLoading) && activeRequests === 0 && 
        currentStage !== LoadingStage.AUTHENTICATION && currentStage !== LoadingStage.INITIAL) {
      loadingLogger.warn('Detected loading flags with no active requests', {
        stage: currentStage,
        isStaticLoading,
        isDynamicLoading,
        requestCount: activeRequests
      });
      
      // Сбрасываем все флаги загрузки
      resetLoading();
      inconsistencyDetected = true;
    }
    
    // Несогласованность 2: Стадия завершена, но флаги загрузки активны
    if (currentStage === LoadingStage.COMPLETED && (isStaticLoading || isDynamicLoading)) {
      loadingLogger.warn('Loading flags still active in COMPLETED stage');
      resetLoading();
      inconsistencyDetected = true;
    }
    
    // Несогласованность 3: Ошибка без сообщения
    if (currentStage === LoadingStage.ERROR && !error) {
      loadingLogger.warn('ERROR stage without error message');
      clearError();
      setStage(LoadingStage.AUTHENTICATION);
      inconsistencyDetected = true;
    }
    
    // Несогласованность 4: Стадия DYNAMIC_CONTENT без активных запросов
    if (currentStage === LoadingStage.DYNAMIC_CONTENT && activeRequests === 0 && 
        !isStaticLoading && !isDynamicLoading) {
      loadingLogger.info('All loading completed in DYNAMIC_CONTENT stage, advancing to COMPLETED');
      setStage(LoadingStage.COMPLETED);
      inconsistencyDetected = true;
    }
    
    return inconsistencyDetected;
  }, [
    currentStage, 
    isStaticLoading, 
    isDynamicLoading, 
    error,
    resetLoading,
    setStage,
    clearError
  ]);
  
  // Обработчик для восстановления после ошибки
  const recoverFromError = useCallback(() => {
    if (currentStage === LoadingStage.ERROR) {
      // Полный сброс системы
      loadingLogger.info('Attempting recovery from ERROR state');
      clearError();
      resetLoading();
      setStage(LoadingStage.AUTHENTICATION);
      return true;
    }
    return false;
  }, [currentStage, clearError, resetLoading, setStage]);

  // Эффект для автоматического восстановления после ошибки через 15 секунд
  useEffect(() => {
    if (currentStage === LoadingStage.ERROR) {
      const autoRecoveryTimer = setTimeout(() => {
        // Проверяем текущее состояние перед восстановлением, чтобы избежать лишних обращений
        // к устаревшему состоянию currentStage внутри recoverFromError
        recoverFromError();
      }, 15000); // 15 секунд на автоматическое восстановление
      
      return () => clearTimeout(autoRecoveryTimer);
    }
  }, [currentStage, recoverFromError]);
  
  // Periodically check for and fix loading inconsistencies
  useEffect(() => {
    const checkInterval = setInterval(() => {
      detectAndFixLoadingInconsistency();
    }, INCONSISTENCY_CHECK_INTERVAL);
    
    return () => clearInterval(checkInterval);
  }, [detectAndFixLoadingInconsistency]);

  // Эффект для автоматического перехода стадий по тайм-ауту
  useEffect(() => {
    // Очищаем предыдущий тайм-аут при изменении стадии
    if (stageTimeoutRef.current) {
      clearTimeout(stageTimeoutRef.current);
      stageTimeoutRef.current = null;
    }

    // Устанавливаем тайм-аут для STATIC_CONTENT
    if (currentStage === LoadingStage.STATIC_CONTENT) {
      stageTimeoutRef.current = setTimeout(() => {
        loadingLogger.info(`Timeout reached for stage ${currentStage}, attempting to advance to DYNAMIC_CONTENT.`);
        // Проверяем, что мы все еще на той же стадии, перед переходом
        if (currentStage === LoadingStage.STATIC_CONTENT) { 
            setStage(LoadingStage.DYNAMIC_CONTENT, false);
        }
      }, 5000); // 5 секунд согласно документации
    }
    
    // TODO: Можно добавить аналогичные тайм-ауты для AUTHENTICATION и DYNAMIC_CONTENT, если нужно
    // Например, для DYNAMIC_CONTENT -> COMPLETED, если долго нет запросов

    // Очистка при размонтировании
    return () => {
      if (stageTimeoutRef.current) {
        clearTimeout(stageTimeoutRef.current);
      }
    };
  }, [currentStage, setStage]); // Зависимость от currentStage и setStage
  
  // Combined context value with all loading data
  const contextValue: LoadingContextType = {
    // Stage data
    currentStage,
    setStage,
    
    // Flags data
    isStaticLoading,
    isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    resetLoading,
    
    // Progress data
    progress,
    setProgress,
    
    // Error data
    error,
    setError,
    
    // Additional functionality
    isAuthChecked,
    setIsAuthChecked,
    detectAndFixLoadingInconsistency,
    recoverFromError
  };
  
  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
};

// Hook to access all loading context data
export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return context;
};

// Default export for convenience
export default LoadingContextProvider;

// Export sub-context hooks for direct access
export { 
  useLoadingStage,
  useLoadingFlags,
  useLoadingProgress,
  useLoadingError
};

// Re-export types
export * from './types'; 