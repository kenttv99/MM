// Центральный файл экспорта для всех контекстов
// Обеспечивает удобные импорты в компонентах

// Экспортируем новые типы и утилиты из корня загрузки
export {
  canChangeStage,
  dispatchStageChangeEvent,
  getStageLevel,
  LoadingStage
} from './loading';

// Новая модульная система загрузки (основной экспорт)
export {
  LoadingProvider,
  useLoading,
  useLoadingStage,
  useLoadingFlags,
  useLoadingProgress,
  useLoadingError
} from './loading';

// Устаревший контекст загрузки (для обратной совместимости)
export {
  LoadingProvider as LegacyLoadingProvider,
  useLoading as useLegacyLoading
} from './loading/LoadingContextLegacy';

// Контексты аутентификации
export { AuthProvider, useAuth } from './AuthContext';
export { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';

// Export types для устаревшего кода - оставляем только один экспорт LoadingStage
// export { LoadingStage } from './loading/types'; 