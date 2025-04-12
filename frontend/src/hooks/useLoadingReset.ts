// frontend/src/hooks/useLoadingReset.ts
import { useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContextLegacy";
import { useTimers } from "@/utils/timerManager";
import { createLogger } from "@/utils/logger";

const logger = createLogger('useLoadingReset');

export function useLoadingReset(resetDelay: number = 2000) {
  const { isDynamicLoading, setDynamicLoading } = useLoading();
  const { setTimeout } = useTimers();

  useEffect(() => {
    if (isDynamicLoading) {
      // Use managed timeout that auto-cleans when component unmounts
      setTimeout('loadingReset', () => {
        if (isDynamicLoading) {
          logger.warn(`Force resetting loading state after ${resetDelay}ms`);
          setDynamicLoading(false);
        }
      }, resetDelay);
    }

    return () => {
      setDynamicLoading(false);
    };
  }, [isDynamicLoading, setDynamicLoading, resetDelay, setTimeout]);

  return { isLoading: isDynamicLoading, setLoading: setDynamicLoading };
}