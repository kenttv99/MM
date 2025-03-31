// frontend/src/hooks/useLoadingReset.ts
import { useEffect } from 'react';
import { usePageLoad } from "@/contexts/PageLoadContext";

/**
 * Hook to reset loading state in components with data fetching
 * @param resetDelay Optional delay in ms before resetting loading state (default: 2000)
 */
export function useLoadingReset(resetDelay: number = 2000) {
  const { isPageLoading, setPageLoading } = usePageLoad();
  
  useEffect(() => {
    // Immediately start a timer to reset loading state
    const timer = setTimeout(() => {
      if (isPageLoading) {
        console.warn(`useLoadingReset: Force resetting loading state after ${resetDelay}ms`);
        setPageLoading(false);
      }
    }, resetDelay);
    
    return () => {
      clearTimeout(timer);
      // Also ensure loading is reset on unmount
      setPageLoading(false);
    };
  }, [isPageLoading, setPageLoading, resetDelay]);
  
  // Make loading state available to component
  return { isPageLoading, setPageLoading };
}