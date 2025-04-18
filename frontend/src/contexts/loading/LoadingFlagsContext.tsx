"use client";
import React, { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';
import { createLogger } from "@/utils/logger";
import { LoadingFlagsContextType, LoadingStage } from './types';
import { useLoadingStage } from './LoadingStageContext';

// Create a namespace-specific logger
const flagsLogger = createLogger('LoadingFlagsContext');

// Create context
const LoadingFlagsContext = createContext<LoadingFlagsContextType | undefined>(undefined);

// Provider component
export const LoadingFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentStage, setStage } = useLoadingStage();
  const [isStaticLoading, setIsStaticLoadingState] = useState(false);
  const [isDynamicLoading, setIsDynamicLoadingState] = useState(false);
  const setActiveRequestsCount = useState(0)[1];
  
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Function for setting static loading
  const setStaticLoading = useCallback((isLoading: boolean) => {
    if (!isMounted.current) return;
    
    setIsStaticLoadingState(prev => {
      if (prev === isLoading) return prev;
      flagsLogger.info('Setting static loading', { isLoading, stage: currentStage });
      
      const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      if (isAdminRoute) {
        if (isLoading) {
          if (currentStage === LoadingStage.AUTHENTICATION || currentStage === LoadingStage.INITIAL) {
            setStage(LoadingStage.STATIC_CONTENT);
            requestAnimationFrame(() => {
              if (isMounted.current) {
                 setStage(LoadingStage.COMPLETED);
              }
            });
            return false;
          } else if (currentStage === LoadingStage.STATIC_CONTENT) {
            setStage(LoadingStage.COMPLETED);
            return false;
          } else {
            return false;
          }
        } else {
          if (currentStage !== LoadingStage.AUTHENTICATION && currentStage !== LoadingStage.INITIAL && currentStage !== LoadingStage.COMPLETED) {
             setStage(LoadingStage.COMPLETED);
          }
          return false;
        }
      } else {
        if (isLoading && currentStage === LoadingStage.AUTHENTICATION) {
          setStage(LoadingStage.STATIC_CONTENT);
        }
        return isLoading;
      }
    });
  }, [currentStage, setStage]);
  
  // Переработанная функция setDynamicLoading
  const setDynamicLoading = useCallback((isLoading: boolean) => {
    if (!isMounted.current) return;

    // Обновляем счетчик и сразу получаем новое значение
    let newCount = 0;
    setActiveRequestsCount(prevCount => {
       newCount = isLoading ? prevCount + 1 : Math.max(0, prevCount - 1);
       flagsLogger.debug("Active requests count updated", { newCount, from: prevCount, change: isLoading ? '+1' : '-1' });
       return newCount;
    });

    // Определяем, должен ли флаг быть true или false
    // Флаг должен быть true, если isLoading=true ИЛИ если newCount > 0
    const shouldBeLoading = isLoading || newCount > 0;

    // Обновляем состояние флага, только если оно изменилось
    setIsDynamicLoadingState(prev => {
      if (prev === shouldBeLoading) return prev;
      flagsLogger.info('Setting dynamic loading', { isLoading, stage: currentStage });
      if (shouldBeLoading) {
        // Если устанавливаем динамическую загрузку, переводим стадию, если необходимо
        if (currentStage < LoadingStage.DYNAMIC_CONTENT && currentStage !== LoadingStage.ERROR) {
          setStage(LoadingStage.DYNAMIC_CONTENT);
        }
      } else {
        // Если сбрасываем динамическую загрузку, проверяем, не пора ли завершить
        // Это может быть преждевременно, лучше полагаться на detectAndFixLoadingInconsistency
        // if (currentStage === LoadingStage.DYNAMIC_CONTENT && !isStaticLoading) {
        //   flagsLogger.info('Dynamic loading ended, setting COMPLETED');
        //   setStage(LoadingStage.COMPLETED);
        // }
      }
      return shouldBeLoading;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, setStage]);
  
  // Reset all loading flags
  const resetLoading = useCallback(() => {
    if (!isMounted.current) return;
    setIsStaticLoadingState(false);
    setIsDynamicLoadingState(false);
    flagsLogger.info('Resetting loading flags');
    if (currentStage !== LoadingStage.COMPLETED && currentStage !== LoadingStage.ERROR) {
      setStage(LoadingStage.COMPLETED);
    }
  }, [currentStage, setStage]);
  
  // Context value
  const contextValue: LoadingFlagsContextType = {
    isStaticLoading,
    isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    resetLoading
  };
  
  return (
    <LoadingFlagsContext.Provider value={contextValue}>
      {children}
    </LoadingFlagsContext.Provider>
  );
};

// Hook to use the loading flags context
export function useLoadingFlags() {
  const context = useContext(LoadingFlagsContext);
  if (!context) {
    throw new Error("useLoadingFlags must be used within a LoadingFlagsProvider");
  }
  return context;
} 