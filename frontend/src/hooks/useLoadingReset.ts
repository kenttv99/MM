// frontend/src/hooks/useLoadingReset.ts
import { useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

export function useLoadingReset(resetDelay: number = 2000) {
  const { isLoading, setLoading } = useLoading();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn(`useLoadingReset: Force resetting loading state after ${resetDelay}ms`);
        setLoading(false);
      }
    }, resetDelay);

    return () => {
      clearTimeout(timer);
      setLoading(false);
    };
  }, [isLoading, setLoading, resetDelay]);

  return { isLoading, setLoading };
}