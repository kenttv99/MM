"use client";
import React, { createContext, useContext, useState, useCallback } from 'react';
import { createLogger } from "@/utils/logger";
import { LoadingProgressContextType } from './types';

// Create a namespace-specific logger
const progressLogger = createLogger('LoadingProgressContext');

// Create context
const LoadingProgressContext = createContext<LoadingProgressContextType | undefined>(undefined);

// Provider component
export const LoadingProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgressState] = useState<number>(0);
  const [error, setErrorState] = useState<string | null>(null);
  
  // Set progress with validation and logging
  const setProgress = useCallback((value: number) => {
    // Validate progress value
    const validProgress = Math.max(0, Math.min(100, value));
    
    if (value !== validProgress) {
      progressLogger.warn('Adjusted invalid progress value', { 
        original: value, 
        adjusted: validProgress 
      });
    }
    
    if (validProgress !== progress) {
      progressLogger.debug('Setting progress', { value: validProgress });
      setProgressState(validProgress);
    }
  }, [progress]);
  
  // Set error with logging
  const setError = useCallback((errorMessage: string | null) => {
    if (errorMessage !== error) {
      if (errorMessage) {
        progressLogger.error('Setting error', { message: errorMessage });
      } else if (error) {
        progressLogger.info('Clearing error');
      }
      setErrorState(errorMessage);
    }
  }, [error]);
  
  // Context value
  const contextValue: LoadingProgressContextType = {
    progress,
    setProgress,
    error,
    setError
  };
  
  return (
    <LoadingProgressContext.Provider value={contextValue}>
      {children}
    </LoadingProgressContext.Provider>
  );
};

// Hook to use the loading progress context
export function useLoadingProgress() {
  const context = useContext(LoadingProgressContext);
  if (!context) {
    throw new Error("useLoadingProgress must be used within a LoadingProgressProvider");
  }
  return context;
} 