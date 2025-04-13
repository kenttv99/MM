"use client";
import React, { createContext, useContext, useCallback, useEffect } from 'react';
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

  // Function to detect and fix loading inconsistencies
  const detectAndFixLoadingInconsistency = useCallback((): boolean => {
    let inconsistencyDetected = false;
    
    // Check for UI lock - static loading with no active requests
    if (isStaticLoading && typeof window !== 'undefined' && 
        window.__activeRequestCount === 0 && 
        currentStage !== LoadingStage.AUTHENTICATION) {
      loadingLogger.warn('Detected UI lock - static loading with no active requests', {
        currentStage,
        requestCount: window.__activeRequestCount
      });
      setStaticLoading(false);
      inconsistencyDetected = true;
    }
    
    // Check for orphaned dynamic loading state
    if (isDynamicLoading && typeof window !== 'undefined' && 
        window.__activeRequestCount === 0 && 
        currentStage !== LoadingStage.AUTHENTICATION) {
      loadingLogger.warn('Detected orphaned dynamic loading state with no active requests', {
        currentStage,
        requestCount: window.__activeRequestCount
      });
      setDynamicLoading(false);
      inconsistencyDetected = true;
    }
    
    // If in completed stage but still loading, reset loading
    if (currentStage === LoadingStage.COMPLETED && (isStaticLoading || isDynamicLoading)) {
      loadingLogger.warn('Loading flags still set in COMPLETED stage', {
        isStaticLoading,
        isDynamicLoading
      });
      resetLoading();
      inconsistencyDetected = true;
    }
    
    // If in error stage but no error message, set stage back to authentication
    if (currentStage === LoadingStage.ERROR && !error) {
      loadingLogger.warn('In ERROR stage but no error message set');
      // Очищаем ошибку перед попыткой смены стадии
      clearError();
      // Пытаемся восстановить систему после ошибки
      setStage(LoadingStage.AUTHENTICATION);
      inconsistencyDetected = true;
    }
    
    return inconsistencyDetected;
  }, [
    currentStage, 
    isStaticLoading, 
    isDynamicLoading, 
    error,
    setStaticLoading,
    setDynamicLoading,
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
        if (currentStage === LoadingStage.ERROR) {
          loadingLogger.info('Auto-recovery from ERROR state triggered');
          recoverFromError();
        }
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