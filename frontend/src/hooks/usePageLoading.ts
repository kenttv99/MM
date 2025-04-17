import { useEffect, useCallback, useRef } from 'react';
import { useLoadingFlags } from '@/contexts/loading/LoadingFlagsContext';
import { useLoadingStage, canChangeStage } from '@/contexts/loading/LoadingStageContext';
import { LoadingStage } from '@/contexts/loading/types';
import { createLogger } from '@/utils/logger';

// Создаем логгер для usePageLoading
const pageLogger = createLogger('usePageLoading');

interface UsePageLoadingOptions {
  // If true, automatically manages loading stages based on component mount/unmount
  autoManage?: boolean;
  // Initial stage to set on mount (only used if autoManage is true)
  initialStage?: LoadingStage;
  // Callback when component is mounted
  onMount?: () => void;
  // Callback when component is unmounted
  onUnmount?: () => void;
  // If true, this is an admin page (affects loading behavior)
  isAdminPage?: boolean;
  // If true, prevents regression to AUTHENTICATION stage
  preventAuthRegression?: boolean;
}

/**
 * Hook for managing page loading stages.
 * 
 * Use this in page components to ensure proper loading sequence:
 * 1. Authentication (managed by auth contexts)
 * 2. Static content (structure, layout, non-data elements)
 * 3. Dynamic content (content that requires data but loads automatically)
 * 4. Data loading (data loaded on user actions)
 */
export function usePageLoading(options: UsePageLoadingOptions = {}) {
  const { 
    autoManage = true, 
    initialStage = LoadingStage.STATIC_CONTENT,
    onMount,
    onUnmount,
    isAdminPage = false,
    preventAuthRegression = true
  } = options;
  
  const { 
    setStaticLoading, 
    setDynamicLoading, 
    resetLoading 
  } = useLoadingFlags();
  const { 
    currentStage, 
    setStage, 
    isAuthChecked 
  } = useLoadingStage();
  
  // Предотвращаем множественные вызовы
  const isInitializedRef = useRef(false);
  const isAdminRouteRef = useRef(false);

  // Проверяем, является ли текущий маршрут админским
  useEffect(() => {
    if (typeof window !== 'undefined') {
      isAdminRouteRef.current = isAdminPage || !!localStorage.getItem('is_admin_route');
    }
  }, [isAdminPage]);

  // Set static content loading
  const startStaticLoading = useCallback(() => {
    if (isAdminRouteRef.current && currentStage !== LoadingStage.AUTHENTICATION) {
      // В админской части избегаем регрессии стадий загрузки
      return;
    }
    
    setStaticLoading(true);
    setStage(LoadingStage.STATIC_CONTENT);
  }, [setStaticLoading, setStage, currentStage]);

  // End static content loading and start dynamic
  const endStaticStartDynamic = useCallback(() => {
    setStaticLoading(false);
    setDynamicLoading(true);
    // Устанавливаем стадию только если текущая не выше
    if (
      currentStage === LoadingStage.AUTHENTICATION || 
      currentStage === LoadingStage.STATIC_CONTENT
    ) {
      setStage(LoadingStage.DYNAMIC_CONTENT);
    }
  }, [setStaticLoading, setDynamicLoading, setStage, currentStage]);

  // End dynamic content loading
  const endDynamicLoading = useCallback(() => {
    setDynamicLoading(false);
    // Устанавливаем стадию только если текущая не выше
    if (
      currentStage === LoadingStage.AUTHENTICATION || 
      currentStage === LoadingStage.STATIC_CONTENT ||
      currentStage === LoadingStage.DYNAMIC_CONTENT
    ) {
      setStage(LoadingStage.COMPLETED);
    }
  }, [setDynamicLoading, setStage, currentStage]);

  // Start data loading (user action)
  const startDataLoading = useCallback(() => {
    setDynamicLoading(true);
  }, [setDynamicLoading]);
  
  // End data loading (user action complete)
  const endDataLoading = useCallback(() => {
    setDynamicLoading(false);
  }, [setDynamicLoading]);

  // Mark loading as complete
  const completeLoading = useCallback(() => {
    setStaticLoading(false);
    setDynamicLoading(false);
    setStage(LoadingStage.COMPLETED);
  }, [setStaticLoading, setDynamicLoading, setStage]);

  // Auto-manage loading stages if enabled
  useEffect(() => {
    if (!autoManage) return;
    
    // Избегаем повторной инициализации
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    // If auth isn't checked yet, don't do anything else
    if (!isAuthChecked) return;
    
    // Для админских страниц применяем особую логику
    if (isAdminRouteRef.current) {
      // Для админа сразу переходим к COMPLETED, если только
      // не находимся в стадии AUTHENTICATION
      if (currentStage !== LoadingStage.AUTHENTICATION) {
        pageLogger.info('Admin page - setting COMPLETED stage');
        completeLoading();
      }
    } else {
      // Для обычных страниц - стандартное поведение
      // Используем централизованную функцию для проверки возможности перехода
      const fakeHistory = [{ stage: currentStage, timestamp: Date.now() }];
      const { allowed, reason } = canChangeStage(currentStage, initialStage, fakeHistory);
      
      if (!allowed && preventAuthRegression) {
        pageLogger.info(`Preventing regression from ${currentStage} to ${initialStage}: ${reason}`);
      } else {
        pageLogger.info(`Setting initial stage to ${initialStage}`);
        setStage(initialStage);
      }
    }
    
    // Execute onMount callback if provided
    if (onMount) onMount();
    
    return () => {
      // Для админских страниц не сбрасываем стадию при размонтировании
      if (isAdminRouteRef.current) {
        pageLogger.info('Admin page unmounting - preserving stage');
      } else if (!preventAuthRegression) {
        // Reset to authentication on unmount for next page only if not preventing regression
        resetLoading();
      }
      
      if (onUnmount) onUnmount();
    };
  }, [
    autoManage, 
    initialStage, 
    isAuthChecked, 
    setStage, 
    onMount, 
    onUnmount, 
    currentStage, 
    preventAuthRegression,
    completeLoading,
    resetLoading
  ]);

  return {
    currentStage,
    isAuthChecked,
    startStaticLoading,
    endStaticStartDynamic,
    endDynamicLoading,
    startDataLoading,
    endDataLoading,
    completeLoading,
    setStage,
    isAdminPage: isAdminRouteRef.current
  };
} 