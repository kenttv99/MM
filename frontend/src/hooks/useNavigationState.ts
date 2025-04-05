import { useEffect, useRef, useState } from 'react';

interface NavigationState {
  isMounted: boolean;
  isNavigating: boolean;
}

export const useNavigationState = (onMount?: () => void, onUnmount?: () => void) => {
  const mountTimestamp = useRef<number>(0);
  const navigationTimeout = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<NavigationState>({
    isMounted: false,
    isNavigating: false,
  });

  useEffect(() => {
    const now = Date.now();
    mountTimestamp.current = now;
    
    setState(prev => ({
      ...prev,
      isMounted: true,
      isNavigating: true,
    }));

    // Clear previous navigation timeout
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
    }

    // Call onMount callback if provided
    onMount?.();

    // Reset navigation flag after a short delay
    navigationTimeout.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isNavigating: false,
      }));
      console.log("Navigation completed");
    }, 100);

    return () => {
      // Clear timeout on unmount
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }

      // Reset state
      setState({
        isMounted: false,
        isNavigating: false,
      });

      // Call onUnmount callback if provided
      onUnmount?.();
    };
  }, [onMount, onUnmount]);

  return {
    isMounted: () => state.isMounted,
    isNavigating: () => state.isNavigating,
    mountTimestamp: () => mountTimestamp.current,
  };
}; 