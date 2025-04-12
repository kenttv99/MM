// This file is a compatibility layer for backward compatibility
// For new code, import directly from '@/contexts/loading'
"use client";
import { 
  LoadingProvider, 
  useLoading, 
  LoadingStage,
  canChangeStage as newCanChangeStage
} from '@/contexts/loading';
import { Logger } from '@/utils/logger';

/**
 * API-compatible version of canChangeStage for backward compatibility
 * In the new implementation, we don't need the logger parameter anymore
 */
export function canChangeStage(
  currentStage: LoadingStage, 
  newStage: LoadingStage, 
  stageHistory: Array<{stage: LoadingStage, timestamp: number}>, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logger?: Logger
) {
  // Forward to new implementation, ignoring the logger parameter
  return newCanChangeStage(currentStage, newStage, stageHistory);
}

// Re-export everything from the new implementation for backward compatibility
export { 
  LoadingProvider,
  useLoading,
  LoadingStage
};

// Default export for backward compatibility
export default LoadingProvider;