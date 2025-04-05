// frontend/src/hooks/useLoadingReset.ts
import { useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

export function useLoadingReset(resetDelay: number = 2000) {
  const { isDynamicLoading, setDynamicLoading } = useLoading();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isDynamicLoading) {
        console.warn(`useLoadingReset: Force resetting loading state after ${resetDelay}ms`);
        setDynamicLoading(false);
      }
    }, resetDelay);

    return () => {
      clearTimeout(timer);
      setDynamicLoading(false);
    };
  }, [isDynamicLoading, setDynamicLoading, resetDelay]);

  return { isLoading: isDynamicLoading, setLoading: setDynamicLoading };
}