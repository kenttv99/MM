"use client";
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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