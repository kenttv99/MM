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

// Helper function to check stage transitions
export function canChangeStage(
  currentStage: LoadingStage, 
  newStage: LoadingStage, 
  stageHistory: StageHistoryEntry[]
): StageChangeResult {
  // 1. Prevent regression to AUTHENTICATION after higher stages
  if (newStage === LoadingStage.AUTHENTICATION) {
    // Check if we've been on a higher stage
    const hasBeenPastAuth = stageHistory.some(
      entry => entry.stage !== LoadingStage.AUTHENTICATION && 
              entry.stage !== LoadingStage.INITIAL
    );
    
    if (hasBeenPastAuth) {
      return { 
        allowed: false, 
        reason: 'Regression to AUTHENTICATION after higher stages is not allowed' 
      };
    }
  }
  
  // 2. Check for stage change cycles
  const now = Date.now();
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
  
  // Set stage with validation
  const setStage = useCallback((newStage: LoadingStage) => {
    const result = canChangeStage(currentStage, newStage, stageHistory);
    
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
          case LoadingStage.INITIAL:
            setStage(LoadingStage.AUTHENTICATION);
            break;
        }
      }, 5000); // 5 second timeout for auto-progression
    }
  }, [currentStage, stageHistory, isMounted]);
  
  // Set initial stage on mount
  useEffect(() => {
    setStage(LoadingStage.AUTHENTICATION);
    
    return () => {
      if (stageTransitionTimerId.current) {
        clearTimeout(stageTransitionTimerId.current);
      }
    };
  }, [setStage]);
  
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