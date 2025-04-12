"use client";
import React, { createContext, useContext, useRef, useCallback } from 'react';
import { createLogger } from "@/utils/logger";
import { LoadingFlagsContextType, LoadingState, LoadingStage } from './types';
import { useLoadingStage, getStageLevel, useIsMounted } from './LoadingStageContext';

// Create a namespace-specific logger
const flagsLogger = createLogger('LoadingFlagsContext');

// Create context
const LoadingFlagsContext = createContext<LoadingFlagsContextType | undefined>(undefined);

// Global active requests counter for tracking
let activeRequestsCount = 0;
// Global flag for tracking last dynamic loading state
let lastDynamicLoadingState = false;

// Provider component
export const LoadingFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentStage, setStage } = useLoadingStage();
  const loadingStateRef = useRef<LoadingState>({ isStaticLoading: false, isDynamicLoading: false });
  const isMounted = useIsMounted();
  
  // Function for setting static loading
  const setStaticLoading = useCallback((isLoading: boolean) => {
    // Log only when state changes
    if (loadingStateRef.current.isStaticLoading !== isLoading) {
      flagsLogger.info('Setting static loading', { isLoading, stage: currentStage });
    }
    
    // Check for admin route
    const isAdminRoute = typeof window !== 'undefined' && 
      window.location.pathname.startsWith('/admin');
    
    // Special behavior for admin routes
    if (isAdminRoute) {
      if (isLoading) {
        // For admin routes, immediately set STATIC_CONTENT,
        // but don't update isStaticLoading if we're at a higher stage
        if (currentStage === LoadingStage.AUTHENTICATION || currentStage === LoadingStage.INITIAL) {
          setStage(LoadingStage.STATIC_CONTENT);
          
          // Accelerated transition for admin routes - immediately go to COMPLETED
          requestAnimationFrame(() => {
            if (isMounted.current) {
              setStage(LoadingStage.COMPLETED);
              loadingStateRef.current.isStaticLoading = false;
            }
          });
        } else if (currentStage === LoadingStage.STATIC_CONTENT) {
          // If we're at STATIC_CONTENT, update the flag but add a timer for auto transition
          loadingStateRef.current.isStaticLoading = isLoading;
          
          // Start immediate transition to COMPLETED
          setStage(LoadingStage.COMPLETED);
          loadingStateRef.current.isStaticLoading = false;
        } else {
          // At higher stages, just ignore the flag
          loadingStateRef.current.isStaticLoading = false;
          return;
        }
      } else {
        // If removing loading flag on admin route, force transition to COMPLETED
        // if we were at STATIC_CONTENT or higher
        if (currentStage !== LoadingStage.AUTHENTICATION && currentStage !== LoadingStage.INITIAL) {
          // Immediately transition to COMPLETED bypassing intermediate stages
          loadingStateRef.current.isStaticLoading = false;
          loadingStateRef.current.isDynamicLoading = false;
          setStage(LoadingStage.COMPLETED);
        }
      }
    } else {
      // Standard behavior for non-admin routes
      if (isLoading && currentStage === LoadingStage.AUTHENTICATION) {
        setStage(LoadingStage.STATIC_CONTENT);
      }
      loadingStateRef.current.isStaticLoading = isLoading;
    }
  }, [currentStage, setStage, isMounted]);
  
  // Function for setting dynamic loading
  const setDynamicLoading = useCallback((isLoading: boolean) => {
    // Skip update if state hasn't changed
    if (loadingStateRef.current.isDynamicLoading === isLoading && lastDynamicLoadingState === isLoading) {
      return;
    }
    
    // Update global state
    lastDynamicLoadingState = isLoading;
    
    // Log only when state changes
    if (loadingStateRef.current.isDynamicLoading !== isLoading) {
      flagsLogger.info('Setting dynamic loading', { isLoading, stage: currentStage });
    }
    
    if (isLoading) {
      activeRequestsCount++;
      if (currentStage === LoadingStage.STATIC_CONTENT) {
        setStage(LoadingStage.DYNAMIC_CONTENT);
      }
    } else {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1);
      
      // If no active requests, explicitly reset all loading flags
      if (activeRequestsCount === 0) {
        // Move to DATA_LOADING stage when all requests complete
        if (currentStage === LoadingStage.DYNAMIC_CONTENT) {
          setStage(LoadingStage.DATA_LOADING);
        }
        
        // Important: explicitly update ref and flag so all components know loading is complete
        loadingStateRef.current.isDynamicLoading = false;
        
        // Update global flag so GlobalSpinner can be updated correctly
        lastDynamicLoadingState = false;
        
        // If we're already at DATA_LOADING stage or higher and no active requests,
        // transition to COMPLETED to ensure spinner is hidden
        const stageLevel = getStageLevel(currentStage);
        if (stageLevel >= 3) { // DATA_LOADING or higher
          setTimeout(() => {
            if (activeRequestsCount === 0 && isMounted.current) {
              setStage(LoadingStage.COMPLETED);
            }
          }, 500);
        }
      } else {
        // If there are still active requests, just update the flag
        loadingStateRef.current.isDynamicLoading = isLoading;
      }
    }
    
    // Add timer for guaranteed state check
    if (!isLoading && activeRequestsCount === 0) {
      setTimeout(() => {
        if (isMounted.current && activeRequestsCount === 0) {
          // Final check and reset
          loadingStateRef.current.isDynamicLoading = false;
          lastDynamicLoadingState = false;
        }
      }, 1000); // Timeout for guaranteed check
    }
  }, [currentStage, setStage, isMounted]);
  
  // Reset all loading flags
  const resetLoading = useCallback(() => {
    loadingStateRef.current.isStaticLoading = false;
    loadingStateRef.current.isDynamicLoading = false;
    lastDynamicLoadingState = false;
    flagsLogger.info('Resetting all loading flags');
  }, []);
  
  // Context value
  const contextValue: LoadingFlagsContextType = {
    isStaticLoading: loadingStateRef.current.isStaticLoading,
    isDynamicLoading: loadingStateRef.current.isDynamicLoading,
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