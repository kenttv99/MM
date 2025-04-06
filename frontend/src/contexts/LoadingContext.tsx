// frontend/src/contexts/LoadingContext.tsx
"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Типы для контекста
interface LoadingContextType {
  isStaticLoading: boolean;
  isDynamicLoading: boolean;
  setStaticLoading: (loading: boolean) => void;
  setDynamicLoading: (loading: boolean) => void;
  resetLoading: () => void;
  isEventsPage: boolean;
}

// Создаем контекст с начальным значением
const LoadingContext = createContext<LoadingContextType>({
  isStaticLoading: false,
  isDynamicLoading: false,
  setStaticLoading: () => {},
  setDynamicLoading: () => {},
  resetLoading: () => {},
  isEventsPage: false,
});

// Специальные пути, для которых не нужно сбрасывать состояние загрузки
const specialPaths = ['/events', '/event/'];

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Состояния загрузки
  const [isStaticLoading, setStaticLoadingState] = useState(false);
  const [isDynamicLoading, setDynamicLoadingState] = useState(false);
  
  // Получаем текущий путь
  const pathname = usePathname();
  
  // Ссылки для отслеживания состояния
  const loadingStateLock = useRef(false);
  const loadingStateTimeout = useRef<NodeJS.Timeout | null>(null);
  const activeRequestsRef = useRef<number>(0);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isEventsPageRef = useRef<boolean>(false);
  const lastLoadingChangeTime = useRef<number>(0);
  const loadingResetTimer = useRef<NodeJS.Timeout | null>(null);
  const autoResetTimer = useRef<NodeJS.Timeout | null>(null);
  const isActive = useRef(true);
  const loadingStateRef = useRef({ isStaticLoading: false, isDynamicLoading: false });
  
  // Константы
  const COOLDOWN_PERIOD = 300; // 300мс для блокировки частых изменений
  
  // Проверяем, является ли текущий путь специальным
  const isSpecialPath = useCallback(() => {
    if (!pathname) return false;
    return specialPaths.some(path => pathname.startsWith(path));
  }, [pathname]);
  
  // Функция для установки статического состояния загрузки
  const setStaticLoading = useCallback((value: boolean) => {
    console.log('LoadingContext: Setting static loading:', { 
      value, 
      currentState: loadingStateRef.current,
      isLocked: loadingStateLock.current
    });
    
    // Проверяем, не заблокировано ли состояние
    if (loadingStateLock.current) {
      console.log('LoadingContext: Loading state is locked, skipping update');
      return;
    }
    
    // Для статической загрузки всегда обновляем состояние
    if (value !== loadingStateRef.current.isStaticLoading) {
      loadingStateLock.current = true;
      lastLoadingChangeTime.current = Date.now();
      
      console.log('LoadingContext: Updating static loading state:', value);
      setStaticLoadingState(value);
      
      // Обновляем ссылку на текущее состояние
      loadingStateRef.current = { 
        ...loadingStateRef.current, 
        isStaticLoading: value 
      };
      
      // Если статическая загрузка завершена, сбрасываем динамическую загрузку
      if (!value) {
        // Даем время для завершения статической загрузки
        setTimeout(() => {
          if (isActive.current) {
            console.log('LoadingContext: Resetting dynamic loading after static loading');
            setDynamicLoadingState(false);
            
            // Обновляем ссылку на текущее состояние
            loadingStateRef.current = { 
              ...loadingStateRef.current, 
              isDynamicLoading: false 
            };
          }
        }, 100);
      }
      
      // Сбрасываем блокировку через COOLDOWN_PERIOD
      if (loadingStateTimeout.current) {
        clearTimeout(loadingStateTimeout.current);
      }
      
      loadingStateTimeout.current = setTimeout(() => {
        loadingStateLock.current = false;
        console.log('LoadingContext: Loading state lock released');
      }, COOLDOWN_PERIOD);
    }
  }, []);
  
  // Функция для установки динамического состояния загрузки
  const setDynamicLoading = useCallback((value: boolean) => {
    console.log('LoadingContext: Setting dynamic loading:', { 
      value, 
      currentState: loadingStateRef.current,
      isLocked: loadingStateLock.current,
      isStaticLoading: loadingStateRef.current.isStaticLoading
    });
    
    // Проверяем, не заблокировано ли состояние и не идет ли статическая загрузка
    if (loadingStateLock.current || loadingStateRef.current.isStaticLoading) {
      console.log('LoadingContext: Loading state is locked or static loading is active, skipping update');
      return;
    }
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, управляем счетчиком активных запросов
    if (isEventsPage) {
    if (value) {
        activeRequestsRef.current++;
    } else {
        activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
      }
      
      console.log('LoadingContext: Events page, active requests:', activeRequestsRef.current);
      
      // Обновляем состояние только если есть активные запросы
      const newLoadingState = activeRequestsRef.current > 0;
      
      if (newLoadingState !== loadingStateRef.current.isDynamicLoading) {
        console.log('LoadingContext: Updating dynamic loading state for events page:', newLoadingState);
        setDynamicLoadingState(newLoadingState);
        
        // Обновляем ссылку на текущее состояние
        loadingStateRef.current = { 
          ...loadingStateRef.current, 
          isDynamicLoading: newLoadingState 
        };
      }
      
      return;
    }
    
    // Для других страниц обновляем состояние с учетом cooldown
    if (value !== loadingStateRef.current.isDynamicLoading) {
      loadingStateLock.current = true;
      lastLoadingChangeTime.current = Date.now();
      
      console.log('LoadingContext: Updating dynamic loading state:', value);
      setDynamicLoadingState(value);
      
      // Обновляем ссылку на текущее состояние
      loadingStateRef.current = { 
        ...loadingStateRef.current, 
        isDynamicLoading: value 
      };
      
      if (loadingStateTimeout.current) {
        clearTimeout(loadingStateTimeout.current);
      }
      
      loadingStateTimeout.current = setTimeout(() => {
        loadingStateLock.current = false;
        console.log('LoadingContext: Loading state lock released');
      }, COOLDOWN_PERIOD);
    }
  }, [isSpecialPath]);
  
  // Функция для сброса состояния загрузки
  const resetLoading = useCallback(() => {
    console.log('LoadingContext: Resetting loading state', { 
      currentState: loadingStateRef.current,
      isLocked: loadingStateLock.current,
      isEventsPage: isEventsPageRef.current,
      activeRequests: activeRequestsRef.current
    });
    
    // Проверяем, не заблокировано ли состояние
    if (loadingStateLock.current) {
      console.log('LoadingContext: Loading state is locked, skipping reset');
      return;
    }
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, не сбрасываем состояние загрузки, если есть активные запросы
    if (isEventsPage && activeRequestsRef.current > 0) {
      console.log('LoadingContext: Events page with active requests, skipping reset');
      return;
    }
    
    // Сбрасываем состояние загрузки
    console.log('LoadingContext: Resetting loading states');
    setStaticLoadingState(false);
    setDynamicLoadingState(false);
    
    // Обновляем ссылку на текущее состояние
    loadingStateRef.current = { 
      isStaticLoading: false, 
      isDynamicLoading: false 
    };
    
    // Сбрасываем счетчик активных запросов
    activeRequestsRef.current = 0;
    
    // Сбрасываем таймер сброса состояния загрузки
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, [isSpecialPath]);
  
  // Эффект для инициализации состояния загрузки
  useEffect(() => {
    console.log('LoadingContext: Initializing loading state', { 
      pathname, 
      isSpecialPath: isSpecialPath(),
      isActive: isActive.current
    });
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, не сбрасываем состояние загрузки
    if (isEventsPage) {
      console.log('LoadingContext: Events page detected, skipping reset');
      return;
    }
    
    // Сбрасываем состояние загрузки
    resetLoading();
    
    // Очищаем таймеры при размонтировании
    return () => {
      console.log('LoadingContext: Cleanup effect triggered');
      isActive.current = false;
      
      if (loadingStateTimeout.current) {
        clearTimeout(loadingStateTimeout.current);
      }
      
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      
      if (loadingResetTimer.current) {
        clearTimeout(loadingResetTimer.current);
      }
      
      if (autoResetTimer.current) {
        clearTimeout(autoResetTimer.current);
      }
    };
  }, [resetLoading, isSpecialPath]);
  
  // Эффект для отслеживания изменений пути
  useEffect(() => {
    console.log('LoadingContext: Path changed', { 
      pathname, 
      isSpecialPath: isSpecialPath(),
      isActive: isActive.current
    });
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, не сбрасываем состояние загрузки
    if (isEventsPage) {
      console.log('LoadingContext: Events page detected, skipping reset');
      return;
    }
    
    // Сбрасываем состояние загрузки
    resetLoading();
  }, [pathname, resetLoading, isSpecialPath]);

  // Автоматический сброс состояния загрузки после 30 секунд
  useEffect(() => {
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPath = specialPaths.some(path => pathname?.startsWith(path));
    
    console.log('LoadingContext: Setting up auto-reset timer', { 
      isEventsPath, 
      isActive: isActive.current
    });
    
    // Если это страница событий, не устанавливаем автоматический сброс
    if (isEventsPath) {
      console.log('LoadingContext: Events page detected, skipping auto-reset');
      return;
    }
    
    // Устанавливаем таймер для сброса состояния загрузки
    const timerId = setTimeout(() => {
      if (isActive.current) {
        console.log('LoadingContext: Auto-resetting loading state after timeout');
        resetLoading();
      }
    }, 30000); // 30 секунд
    
    // Очищаем таймер при размонтировании или изменении пути
    return () => {
      console.log('LoadingContext: Clearing auto-reset timer');
      clearTimeout(timerId);
    };
  }, [pathname, resetLoading, isSpecialPath]);

  // Добавляем эффект для предотвращения блокировки интерфейса
  useEffect(() => {
    console.log('LoadingContext: Setting up UI lock prevention', { 
      isDynamicLoading, 
      isActive: isActive.current
    });
    
    // Если состояние загрузки активно более 15 секунд, сбрасываем его
    if (isDynamicLoading) {
      const timerId = setTimeout(() => {
        if (isActive.current) {
          console.log('LoadingContext: Preventing UI lock by resetting loading state');
          resetLoading();
        }
      }, 15000); // 15 секунд для предотвращения блокировки
      
      return () => {
        console.log('LoadingContext: Clearing UI lock prevention timer');
        clearTimeout(timerId);
      };
    }
  }, [isDynamicLoading, resetLoading]);
  
  // Добавляем эффект для отслеживания статической загрузки
  useEffect(() => {
    console.log('LoadingContext: Setting up static loading tracker', { 
      isStaticLoading, 
      isActive: isActive.current
    });
    
    // Проверяем наличие глобального спиннера
    const checkGlobalSpinner = () => {
      const spinner = document.querySelector('.global-spinner');
      if (spinner && !loadingStateRef.current.isStaticLoading) {
        console.log('LoadingContext: Global spinner detected, setting static loading');
        setStaticLoadingState(true);
        
        // Обновляем ссылку на текущее состояние
        loadingStateRef.current = { 
          ...loadingStateRef.current, 
          isStaticLoading: true 
        };
      } else if (!spinner && loadingStateRef.current.isStaticLoading) {
        console.log('LoadingContext: Global spinner removed, resetting static loading');
        setStaticLoadingState(false);
        
        // Обновляем ссылку на текущее состояние
        loadingStateRef.current = { 
          ...loadingStateRef.current, 
          isStaticLoading: false 
        };
      }
    };
    
    // Проверяем сразу
    checkGlobalSpinner();
    
    // Устанавливаем интервал для проверки
    const intervalId = setInterval(checkGlobalSpinner, 100);
    
    // Очищаем интервал при размонтировании
    return () => {
      console.log('LoadingContext: Clearing static loading tracker interval');
      clearInterval(intervalId);
    };
  }, [isStaticLoading]);
  
  // Предоставляем контекст
  const value = {
    isStaticLoading,
    isDynamicLoading,
    setStaticLoading,
    setDynamicLoading,
    resetLoading,
    isEventsPage: isEventsPageRef.current
  };
  
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

// Хук для использования контекста
export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};