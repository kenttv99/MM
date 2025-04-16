"use client";
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { createLogger } from "@/utils/logger";
import { LoadingErrorContextType } from './types';
import { useLoadingStage } from './LoadingStageContext';
import { LoadingStage } from './types';

// Create a namespace-specific logger
const errorLogger = createLogger('LoadingErrorContext');

// Create context
const LoadingErrorContext = createContext<LoadingErrorContextType | undefined>(undefined);

// Provider component
export const LoadingErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setErrorState] = useState<string | null>(null);
  const { setStage } = useLoadingStage();
  
  // Set error with logging and stage transition
  const setError = useCallback((errorMessage: string | null) => {
    if (errorMessage !== error) {
      if (errorMessage) {
        errorLogger.error('Loading error occurred', { message: errorMessage });
        setStage(LoadingStage.ERROR);
      } else if (error) {
        errorLogger.info('Clearing loading error');
      }
      setErrorState(errorMessage);
    }
  }, [error, setStage]);
  
  // Clear error convenience method
  const clearError = useCallback(() => {
    if (error) {
      errorLogger.info('Clearing loading error');
      setErrorState(null);
      // Resume loading from authentication
      setStage(LoadingStage.AUTHENTICATION);
    }
  }, [error, setStage]);
  
  // Computed property for convenience
  const hasError = useMemo(() => Boolean(error), [error]);
  
  // Эффект для прослушивания события 'loading-error' и 'api-not-found'
  useEffect(() => {
    const handleLoadingError = (event: Event) => {
      const customEvent = event as CustomEvent;
      const errorDetail = customEvent.detail;
      
      if (errorDetail && errorDetail.error) {
        errorLogger.error('Loading error event received', {
          error: errorDetail.error,
          source: errorDetail.source || 'unknown'
        });
        
        setError(errorDetail.error);
      }
    };
    
    // Обработчик для событий 404
    const handleNotFound = (event: Event) => {
      const customEvent = event as CustomEvent;
      const details = customEvent.detail;
      
      errorLogger.warn('Not Found (404) event received', {
        endpoint: details?.endpoint || 'unknown',
        method: details?.method || 'unknown'
      });
      
      // Сохраняем в sessionStorage информацию о последнем 404
      if (typeof window !== 'undefined') {
        // Устанавливаем флаг для компонента 404
        sessionStorage.setItem('last_404_endpoint', details?.endpoint || 'unknown');
        // Добавляем флаг для предотвращения повторных запросов
        sessionStorage.setItem('last_404_timestamp', Date.now().toString());
        
        // Проверяем, находимся ли мы на странице события и обрабатываем ли 404 ошибку события
        const isEventPath = window.location.pathname.includes('/events/');
        const isEventEndpoint = (details?.endpoint || '').includes('/events/');
        
        // Если уже находимся на странице события и это 404 для события,
        // то не перезагружаем страницу - компонент EventPage сам обработает ошибку
        if (isEventPath && isEventEndpoint) {
          errorLogger.info('Not redirecting to 404 page as we are on event page', {
            path: window.location.pathname,
            endpoint: details?.endpoint
          });
          return;
        }
        
        // Если страница уже 404, просто обновляем данные
        if (window.location.pathname.includes('/404')) {
          window.dispatchEvent(new Event('404_refresh'));
        } else {
          // Используем window.location.replace вместо pathname для полного прерывания выполнения
          window.location.replace('/404');
        }
      }
    };
    
    window.addEventListener('loading-error', handleLoadingError);
    window.addEventListener('api-not-found', handleNotFound);
    
    return () => {
      window.removeEventListener('loading-error', handleLoadingError);
      window.removeEventListener('api-not-found', handleNotFound);
    };
  }, []);
  
  // Context value
  const contextValue: LoadingErrorContextType = {
    error,
    setError,
    clearError,
    hasError
  };
  
  return (
    <LoadingErrorContext.Provider value={contextValue}>
      {children}
    </LoadingErrorContext.Provider>
  );
};

// Hook to use the loading error context
export function useLoadingError() {
  const context = useContext(LoadingErrorContext);
  if (!context) {
    throw new Error("useLoadingError must be used within a LoadingErrorProvider");
  }
  return context;
} 