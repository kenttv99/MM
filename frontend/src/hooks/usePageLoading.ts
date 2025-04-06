import { useEffect, useCallback } from 'react';
import { useLoading, LoadingStage } from '@/contexts/LoadingContext';

interface UsePageLoadingOptions {
  // If true, automatically manages loading stages based on component mount/unmount
  autoManage?: boolean;
  // Initial stage to set on mount (only used if autoManage is true)
  initialStage?: LoadingStage;
  // Callback when component is mounted
  onMount?: () => void;
  // Callback when component is unmounted
  onUnmount?: () => void;
}

/**
 * Hook for managing page loading stages.
 * 
 * Use this in page components to ensure proper loading sequence:
 * 1. Authentication (managed by auth contexts)
 * 2. Static content (structure, layout, non-data elements)
 * 3. Dynamic content (content that requires data but loads automatically)
 * 4. Data loading (data loaded on user actions)
 */
export function usePageLoading(options: UsePageLoadingOptions = {}) {
  const { 
    autoManage = true, 
    initialStage = LoadingStage.STATIC_CONTENT,
    onMount,
    onUnmount
  } = options;
  
  const { 
    setStaticLoading, 
    setDynamicLoading, 
    currentStage, 
    setStage, 
    isAuthChecked 
  } = useLoading();

  // Set static content loading
  const startStaticLoading = useCallback(() => {
    setStaticLoading(true);
    setStage(LoadingStage.STATIC_CONTENT);
  }, [setStaticLoading, setStage]);

  // End static content loading and start dynamic
  const endStaticStartDynamic = useCallback(() => {
    setStaticLoading(false);
    setDynamicLoading(true);
    setStage(LoadingStage.DYNAMIC_CONTENT);
  }, [setStaticLoading, setDynamicLoading, setStage]);

  // End dynamic content loading
  const endDynamicLoading = useCallback(() => {
    setDynamicLoading(false);
    setStage(LoadingStage.DATA_LOADING);
  }, [setDynamicLoading, setStage]);

  // Start data loading (user action)
  const startDataLoading = useCallback(() => {
    setDynamicLoading(true);
  }, [setDynamicLoading]);
  
  // End data loading (user action complete)
  const endDataLoading = useCallback(() => {
    setDynamicLoading(false);
  }, [setDynamicLoading]);

  // Mark loading as complete
  const completeLoading = useCallback(() => {
    setStaticLoading(false);
    setDynamicLoading(false);
    setStage(LoadingStage.COMPLETED);
  }, [setStaticLoading, setDynamicLoading, setStage]);

  // Auto-manage loading stages if enabled
  useEffect(() => {
    if (!autoManage) return;
    
    // If auth isn't checked yet, don't do anything else
    if (!isAuthChecked) return;
    
    // Set initial stage on mount
    setStage(initialStage);
    
    // Execute onMount callback if provided
    if (onMount) onMount();
    
    return () => {
      // Reset to authentication on unmount for next page
      if (onUnmount) onUnmount();
    };
  }, [autoManage, initialStage, isAuthChecked, setStage, onMount, onUnmount]);

  return {
    currentStage,
    isAuthChecked,
    startStaticLoading,
    endStaticStartDynamic,
    endDynamicLoading,
    startDataLoading,
    endDataLoading,
    completeLoading,
    setStage
  };
} 