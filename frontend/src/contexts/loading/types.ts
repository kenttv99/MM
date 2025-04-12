// Types for loading stages - simplified version without duplicates
export enum LoadingStage {
  AUTHENTICATION = 'authentication',
  STATIC_CONTENT = 'static_content',
  DYNAMIC_CONTENT = 'dynamic_content',
  DATA_LOADING = 'data_loading',
  COMPLETED = 'completed',
  INITIAL = 'initial', // Only for initial state
  ERROR = 'error'      // For error handling
}

// Extend Window interface to include loading properties
declare global {
  interface Window {
    __activeRequestCount?: number;
    __loading_stage__?: LoadingStage;
  }
}

// Interface for stage transition check result
export interface StageChangeResult {
  allowed: boolean;
  reason?: string;
}

// Stage history entry type
export interface StageHistoryEntry {
  stage: LoadingStage;
  timestamp: number;
}

// Basic loading state interface
export interface LoadingState {
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
}

// Stage context interface
export interface LoadingStageContextType {
  currentStage: LoadingStage;
  setStage: (stage: LoadingStage) => void;
  stageHistory: StageHistoryEntry[];
  isAuthChecked: boolean;
  setIsAuthChecked: (checked: boolean) => void;
}

// Loading flags context interface
export interface LoadingFlagsContextType {
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
  setStaticLoading: (isLoading: boolean) => void;
  setDynamicLoading: (isLoading: boolean) => void;
  resetLoading: () => void;
}

// Progress context interface
export interface LoadingProgressContextType {
  progress: number;
  setProgress: (progress: number) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

// Error context interface
export interface LoadingErrorContextType {
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
  hasError: boolean;
}

// Loading context interface that combines all context types
export interface LoadingContextType {
  // From LoadingStageContext
  currentStage: LoadingStage;
  setStage: (stage: LoadingStage) => void;
  
  // From LoadingFlagsContext
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
  setStaticLoading: (isLoading: boolean) => void;
  setDynamicLoading: (isLoading: boolean) => void;
  resetLoading: () => void;
  
  // From LoadingProgressContext
  progress: number;
  setProgress: (progress: number) => void;
  
  // From LoadingErrorContext
  error: string | null;
  setError: (error: string | null) => void;
  
  // Additional functionality
  isAuthChecked: boolean;
  setIsAuthChecked: (checked: boolean) => void;
  detectAndFixLoadingInconsistency: () => boolean;
} 