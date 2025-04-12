import { LoadingStage, StageChangeResult, StageHistoryEntry } from './loading/types';

// Interface for canChangeStage parameters
export interface CanChangeStageParams {
  currentStage: LoadingStage;
  newStage: LoadingStage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: any;
  stageHistory?: StageHistoryEntry[];
}

export function canChangeStage({
  currentStage,
  newStage, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logger,
  stageHistory = []
}: CanChangeStageParams): StageChangeResult {
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