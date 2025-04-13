import { LoadingStage, StageChangeResult, StageHistoryEntry } from './loading/types';

// Interface for canChangeStage parameters
export interface CanChangeStageParams {
  currentStage: LoadingStage;
  newStage: LoadingStage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: any;
  stageHistory?: StageHistoryEntry[];
  isUnauthorizedResponse?: boolean;
}

export function canChangeStage({
  currentStage,
  newStage, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logger,
  stageHistory = [],
  isUnauthorizedResponse = false
}: CanChangeStageParams): StageChangeResult {
  // Особый случай: Разрешаем переход из ERROR в начальную стадию AUTHENTICATION при сбросе ошибки
  if (currentStage === LoadingStage.ERROR && newStage === LoadingStage.AUTHENTICATION) {
    return { allowed: true, reason: 'Error state recovery' };
  }
  
  // Особый случай: Всегда разрешаем переход из любой стадии в ERROR
  if (newStage === LoadingStage.ERROR) {
    return { allowed: true, reason: 'Error state transition' };
  }
  
  // Особая обработка для входа - всегда разрешаем переход на STATIC_CONTENT при авторизации
  if (newStage === LoadingStage.STATIC_CONTENT && currentStage === LoadingStage.AUTHENTICATION) {
    return { allowed: true, reason: 'Authentication flow progression' };
  }

  // 1. Prevent regression to AUTHENTICATION after higher stages,
  // unless it's an unauthorized response (401)
  if (newStage === LoadingStage.AUTHENTICATION) {
    // Check if we've been on a higher stage
    const hasBeenPastAuth = stageHistory.some(
      entry => entry.stage !== LoadingStage.AUTHENTICATION && 
              entry.stage !== LoadingStage.INITIAL &&
              entry.stage !== LoadingStage.ERROR
    );
    
    // If this is a 401 response, allow regression
    if (hasBeenPastAuth && !isUnauthorizedResponse) {
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
  
  // 4. Проверка на скачки через стадии (например, из AUTHENTICATION сразу в COMPLETED)
  const currentLevel = getStageLevel(currentStage);
  const newLevel = getStageLevel(newStage);
  
  // Не позволяем пропускать более одной стадии, кроме специальных случаев
  if (newLevel > currentLevel + 1 && 
      !(currentStage === LoadingStage.INITIAL || currentStage === LoadingStage.ERROR)) {
    // Разрешаем прямой переход к COMPLETED из любой стадии, если страница уже загружена ранее
    const hasCompletedBefore = stageHistory.some(entry => entry.stage === LoadingStage.COMPLETED);
    if (newStage === LoadingStage.COMPLETED && hasCompletedBefore) {
      return { allowed: true, reason: 'Fast transition to COMPLETED for previously loaded page' };
    }
    
    return {
      allowed: false,
      reason: `Cannot skip stages from ${currentStage} to ${newStage}`
    };
  }
  
  // Transition allowed
  return { allowed: true };
}

// Helper to get stage level (higher number = later stage)
function getStageLevel(stage: LoadingStage): number {
  switch (stage) {
    case LoadingStage.INITIAL: return -1;
    case LoadingStage.ERROR: return -1;
    case LoadingStage.AUTHENTICATION: return 0;
    case LoadingStage.STATIC_CONTENT: return 1;
    case LoadingStage.DYNAMIC_CONTENT: return 2;
    case LoadingStage.DATA_LOADING: return 3;
    case LoadingStage.COMPLETED: return 4;
    default: return -1;
  }
} 