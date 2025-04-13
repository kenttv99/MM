// Export all contexts from a central location
// This makes imports cleaner in components

// Legacy Loading Context
export {
  LoadingProvider as LoadingProviderLegacy,
  useLoading as useLoadingLegacy,
  LoadingStage as LoadingStageLegacy
} from './LoadingContextLegacy';

// New modular loading system
export {
  LoadingProvider,
  useLoading,
  useLoadingStage,
  useLoadingFlags,
  useLoadingProgress,
  useLoadingError,
  LoadingStage as LoadingStageNew
} from './loading';

// Auth contexts
export { AuthProvider, useAuth } from './AuthContext';
export { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';

// Export types для устаревшего кода - оставляем только один экспорт LoadingStage
// export { LoadingStage } from './loading/types'; 