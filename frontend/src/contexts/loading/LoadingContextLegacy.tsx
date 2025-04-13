"use client";
import React, { createContext, useContext } from 'react';
import { createLogger } from "@/utils/logger";
import { useLoading as useNewLoading, LoadingStage } from '@/contexts/loading';

// Создаем логгер для отслеживания использования устаревшего контекста
const legacyLogger = createLogger('LoadingContextLegacy');

// Определяем интерфейс устаревшего контекста
interface LegacyLoadingContextType {
  loading: boolean;
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
  loadingStage: string;
  currentStage: LoadingStage;
  setLoading: (isLoading: boolean) => void;
  setStaticLoading: (isLoading: boolean) => void;
  setDynamicLoading: (isLoading: boolean) => void;
  setStage: (stage: LoadingStage, isUnauthorizedResponse?: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

// Создаем контекст с значением по умолчанию null
const LegacyLoadingContext = createContext<LegacyLoadingContextType | null>(null);

// Адаптер для новой системы загрузки, предоставляющий устаревший интерфейс
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Используем новую систему загрузки
  const {
    currentStage,
    isStaticLoading,
    isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    progress,
    setProgress,
    error,
    setError,
    setStage: newSetStage
  } = useNewLoading();
  
  // Логируем использование устаревшего контекста при его создании
  React.useEffect(() => {
    legacyLogger.warn(
      'Устаревший контекст LoadingContext используется. Рекомендуется перейти на новую модульную систему загрузки.'
    );
  }, []);
  
  // Преобразуем стадию в строку для обратной совместимости
  const legacyStage = React.useMemo(() => {
    switch (currentStage) {
      case LoadingStage.AUTHENTICATION: return 'authentication';
      case LoadingStage.STATIC_CONTENT: return 'static_content';
      case LoadingStage.DYNAMIC_CONTENT: return 'dynamic_content';
      case LoadingStage.COMPLETED: return 'completed';
      case LoadingStage.ERROR: return 'error';
      default: return 'initial';
    }
  }, [currentStage]);
  
  // Создаем совместимый интерфейс для старых компонентов
  const legacyContextValue: LegacyLoadingContextType = {
    // В устаревшей системе loading был общим флагом загрузки
    loading: isStaticLoading || isDynamicLoading,
    isStaticLoading,
    isDynamicLoading,
    loadingStage: legacyStage,
    currentStage,
    // Общая функция setLoading для обратной совместимости - устанавливает оба флага
    setLoading: (isLoading: boolean) => {
      setStaticLoading(isLoading);
      setDynamicLoading(isLoading);
      legacyLogger.info('Вызов устаревшего метода setLoading', { isLoading });
    },
    setStaticLoading,
    setDynamicLoading,
    setStage: (stage: LoadingStage, isUnauthorizedResponse?: boolean) => {
      // Используем newSetStage, который получен на уровне компонента
      newSetStage(stage, isUnauthorizedResponse);
      legacyLogger.info('Вызов устаревшего метода setStage', { stage, isUnauthorizedResponse });
    },
    progress,
    setProgress,
    error,
    setError
  };
  
  return (
    <LegacyLoadingContext.Provider value={legacyContextValue}>
      {children}
    </LegacyLoadingContext.Provider>
  );
};

// Хук для использования устаревшего контекста с предупреждением
export function useLoading() {
  const context = useContext(LegacyLoadingContext);
  
  if (!context) {
    throw new Error('useLoading должен использоваться внутри LegacyLoadingProvider');
  }
  
  // Логируем использование хука при каждом вызове в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    legacyLogger.warn(
      'Использован устаревший хук useLoading. Рекомендуется перейти на новую модульную систему загрузки с хуками useLoadingStage, useLoadingFlags и т.д.'
    );
  }
  
  return context;
}

// Экспортируем для обратной совместимости
export default LoadingProvider; 