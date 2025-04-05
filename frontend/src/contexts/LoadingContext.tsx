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
  const globalLoadingLock = useRef(false);
  const loadingResetTimer = useRef<NodeJS.Timeout | null>(null);
  const autoResetTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Константы
  const COOLDOWN_PERIOD = 300; // 300мс для блокировки частых изменений
  
  // Проверяем, является ли текущий путь специальным
  const isSpecialPath = useCallback(() => {
    if (!pathname) return false;
    return specialPaths.some(path => pathname.startsWith(path));
  }, [pathname]);
  
  // Функция для установки статического состояния загрузки
  const setStaticLoading = useCallback((value: boolean) => {
    // Проверяем, не заблокировано ли состояние
    if (loadingStateLock.current || globalLoadingLock.current) {
      return;
    }
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, разрешаем любые изменения состояния
    if (isEventsPage) {
      setStaticLoadingState(value);
      return;
    }
    
    // Для не-событийных страниц проверяем, не слишком ли часто меняется состояние
    if (value !== isStaticLoading) {
      loadingStateLock.current = true;
      lastLoadingChangeTime.current = Date.now();
      setStaticLoadingState(value);
      
      // Сбрасываем блокировку через COOLDOWN_PERIOD
      if (loadingStateTimeout.current) {
        clearTimeout(loadingStateTimeout.current);
      }
      
      loadingStateTimeout.current = setTimeout(() => {
        loadingStateLock.current = false;
      }, COOLDOWN_PERIOD);
    }
  }, [isStaticLoading, isSpecialPath]);
  
  // Функция для установки динамического состояния загрузки
  const setDynamicLoading = useCallback((value: boolean) => {
    // Проверяем, не заблокировано ли состояние
    if (loadingStateLock.current) {
      return;
    }
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, разрешаем любые изменения состояния
    if (isEventsPage) {
      // Если устанавливаем состояние загрузки в true, увеличиваем счетчик активных запросов
      if (value) {
        activeRequestsRef.current++;
      } else {
        // Если устанавливаем состояние загрузки в false, уменьшаем счетчик активных запросов
        activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
      }
      
      setDynamicLoadingState(value);
      
      // Если есть активные запросы, не сбрасываем состояние загрузки
      if (activeRequestsRef.current > 0) {
        return;
      }
      
      // Устанавливаем таймер для сброса состояния загрузки через 15 секунд для страницы событий
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      
      resetTimeoutRef.current = setTimeout(() => {
        if (activeRequestsRef.current === 0) {
          setDynamicLoadingState(false);
        }
      }, 15000); // 15 секунд для страницы событий
      
      return;
    }
    
    // Для не-событийных страниц проверяем, не слишком ли часто меняется состояние
    if (value !== isDynamicLoading) {
      loadingStateLock.current = true;
      lastLoadingChangeTime.current = Date.now();
      setDynamicLoadingState(value);
      
      // Сбрасываем блокировку через COOLDOWN_PERIOD
      if (loadingStateTimeout.current) {
        clearTimeout(loadingStateTimeout.current);
      }
      
      loadingStateTimeout.current = setTimeout(() => {
        loadingStateLock.current = false;
      }, COOLDOWN_PERIOD);
    }
  }, [isDynamicLoading, isSpecialPath]);
  
  // Функция для сброса состояния загрузки
  const resetLoading = useCallback(() => {
    // Проверяем, не заблокировано ли состояние
    if (loadingStateLock.current) {
      return;
    }
    
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, не сбрасываем состояние загрузки, если есть активные запросы
    if (isEventsPage && activeRequestsRef.current > 0) {
      return;
    }
    
    // Сбрасываем состояние загрузки
    setStaticLoadingState(false);
    setDynamicLoadingState(false);
    
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
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, не сбрасываем состояние загрузки
    if (isEventsPage) {
      return;
    }
    
    // Сбрасываем состояние загрузки
    resetLoading();
    
    // Очищаем таймеры при размонтировании
    return () => {
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
    // Проверяем, является ли текущий путь страницей событий
    const isEventsPage = isSpecialPath();
    isEventsPageRef.current = isEventsPage;
    
    // Если это страница событий, не сбрасываем состояние загрузки
    if (isEventsPage) {
      return;
    }
    
    // Сбрасываем состояние загрузки
    resetLoading();
  }, [pathname, resetLoading, isSpecialPath]);
  
  // Эффект для автоматического сброса состояния загрузки
  useEffect(() => {
    let isActive = true;
    
    // Устанавливаем таймер для автоматического сброса состояния загрузки
    if (loadingResetTimer.current) {
      clearTimeout(loadingResetTimer.current);
    }
    
    if (isDynamicLoading) {
      loadingResetTimer.current = setTimeout(() => {
        // Сбрасываем состояние загрузки, если прошло слишком много времени
        if (isActive) {
          console.log("LoadingContext: Auto-resetting loading state");
          setDynamicLoadingState(false);
          activeRequestsRef.current = 0;
        }
      }, 30000); // 30 секунд для автоматического сброса
    }
    
    return () => {
      isActive = false;
      if (loadingResetTimer.current) {
        clearTimeout(loadingResetTimer.current);
      }
    };
  }, [isDynamicLoading, setDynamicLoadingState]);
  
  // Эффект для автоматического сброса состояния загрузки при монтировании
  useEffect(() => {
    // Устанавливаем таймер для автоматического сброса состояния загрузки при монтировании
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
    
    if (isDynamicLoading) {
      autoResetTimer.current = setTimeout(() => {
        console.log("LoadingContext: Auto-resetting loading state on mount");
        setDynamicLoadingState(false);
        activeRequestsRef.current = 0;
      }, 5000); // 5 секунд для автоматического сброса при монтировании
    }
    
    return () => {
      if (autoResetTimer.current) {
        clearTimeout(autoResetTimer.current);
      }
    };
  }, [isDynamicLoading, setDynamicLoadingState]);
  
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